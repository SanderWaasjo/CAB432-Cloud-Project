var express = require('express');
var router = express.Router();
const { exec } = require('child_process');
const multer = require('multer');
const responseTime = require('response-time')
const axios = require('axios');
const redis = require('redis');
require('dotenv').config();
const AWS = require('aws-sdk');
const app = express();
const fs = require('fs');



const { Hash } = require('@smithy/hash-node');
const region = 	'ap-southeast-2';




// Create a Redis client
const redisClient = redis.createClient({
  host: 'localhost', // Your Redis server host
  port: 6379,        // Your Redis server port
});

redisClient.connect()
	.catch((err) => {
		console.log(err);
});
// Connect to Redis
redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Handle errors
redisClient.on('error', (err) => {
  console.error('Redis Error:', err);
});


// Used to display response time in HTTP header
app.use(responseTime());	

AWS.config.update({
	accessKeyId: process.env.aws_access_key_id,
	secretAccessKey: process.env.aws_secret_access_key,
	sessionToken: process.env.aws_session_token,
	region: region,
});


//S3 setup
const bucketName = "n11725630-project"; 
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

s3.createBucket({ Bucket: bucketName })
	.promise()
	.then(() => console.log(`Created bucket: ${bucketName}`))
	.catch((err) => {
		// We will ignore 409 errors which indicate that the bucket already exists
		if (err.statusCode !== 409) {
			console.log(`Error creating bucket: ${err}`);
		}
	});



// Multer logic for uploading photos to disk
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Set the destination folder for uploaded files
  },
  filename: function (req, file, cb) {
    // const ext = file.originalname.split('.').pop(); // Get the file extension
    // cb(null, Date.now() + '.' + ext); // Set a unique filename using a timestamp
    const ext = file.originalname.split('.').pop(); // Get the file extension
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });



router.post('/', upload.array('photo'), async (req, res) => {
  const uploadedFiles = req.files || [];
  const transformedPhotoDataBW = [];
  const transformedPhotoDataBlurred = [];
  const transformedPhotoDataXXXX = [];

  const s3_promises = [];

  async function processFile(file) {
    const uploadedFilePath = file.path;
    const outputFilePathGray = `uploads-gray/gray-${file.filename}`;
    const outputFilePathBlurred = `uploads-Blurred/${file.filename}`;
    const outputFilePathXXXX = `uploads-XXXX/${file.filename}`;
    const storageKeyGray = `gray-${file.filename}`;
    const storageKeyBlurred = `Blurred-${file.filename}`;
    const storageKeyXXXX = `XXXX-${file.filename}`;

    const result = await redisClient.get(storageKeyGray);
  
    if (!result) {      
      s3_promises.push(checkS3BucketAndGenerateNewImage(bucketName, storageKeyGray, storageKeyBlurred, storageKeyXXXX, transformedPhotoDataBW, transformedPhotoDataBlurred, transformedPhotoDataXXXX, uploadedFilePath, outputFilePathGray, outputFilePathBlurred, outputFilePathXXXX));
    }
  }
  

  // Process each uploaded file in parallel
  await Promise.all(uploadedFiles.map(processFile));
  await Promise.all(s3_promises);

  await fs.readdir('uploads', (err, files) => {
    if (err) {
      console.error(err);
      return;
    }
    for (const file of files) {
      deleteLocalFile(`uploads/${file}`);
    }
  });



   // Fetch the last saved day from Redis
   let lastSavedDay;
   try {
     const lastSavedDayISOString = await redisClient.get('lastSavedDay');
     console.log('Last saved day::', lastSavedDayISOString);
     if (!lastSavedDayISOString) {
      lastSavedDay = new Date();
      lastSavedDay.setDate(lastSavedDay.getDate() - 1);  // set to yesterday as a default
    } else {
      lastSavedDay = new Date(lastSavedDayISOString);
    }
    
   } catch (err) {
     console.error('Error fetching last saved day:', err);
   }
 
   // Check if it's a new day
   if (lastSavedDay && isNewDay(lastSavedDay)) {
     // Reset the upload count and update the last saved day in Redis
     try {
       await redisClient.set('uploadCount', '0');
       await redisClient.set('lastSavedDay', new Date().toISOString());

     } catch (err) {
       console.error('Error resetting upload count or updating last saved day:', err);
     }
   }

  // Increment the upload count in Redis
  try {
    await redisClient.incr('uploadCount');
  } catch (err) {
    console.error('Error incrementing upload count:', err);
  }

  // Fetch the total upload count from Redis
  let totalUploadCount;
  try {
    totalUploadCount = await redisClient.get('uploadCount');
  } catch (err) {
    console.error('Error fetching upload count:', err);
  }
  
  console.log('Total number of uploads:', totalUploadCount);
  
  console.log('Total transformation time for B/W images:', totalTransformationTimeBW);
  console.log('Total transformation time for Blurred images:', totalTransformationTimeBlurred);
  console.log('Total transformation time for XXXX images:', totalTransformationTimeXXXX);



  res.render('index', {
    uploadTransformedPhotosBW: transformedPhotoDataBW,
    uploadTransformedPhotosBlurred: transformedPhotoDataBlurred,
    uploadTransformedPhotosXXXX: transformedPhotoDataXXXX,
    totalTransformationTimeBW,
    totalTransformationTimeBlurred,
    totalTransformationTimeXXXX,
    totalUploadCount
    });
});



router.get("/", async function (req, res) {
  res.render('index', {
      
  });
});

module.exports = router;


//Function for uploading to the S3 bucket
async function uploadToS3AndStoreInList(data, storageKey, bucketName, transformedPhotoData) {
        const s3Params = { Bucket: bucketName, Key: storageKey, Body: data };
        try {
          await s3.putObject(s3Params).promise();
          console.log(`Successfully uploaded data to ${bucketName}${storageKey}`);
          const s3URL = `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${storageKey}`;

      
          transformedPhotoData.push({ storageKey, s3URL });
          //console.log(transformedPhotoData);
        } catch (err) {
          console.log('Something went wrong when accessing the S3 bucket:', err);
        }
      }

async function deleteLocalFile(path){
  fs.unlink(path, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log('File deleted successfully from: ',path);
  });
}


let totalTransformationTimeBW = 0;
let totalTransformationTimeBlurred = 0;
let totalTransformationTimeXXXX = 0;

//Function for checking the S3 bucket for already transformed photos, or we generate a new image based on the API response
async function checkS3BucketAndGenerateNewImage(bucketName, storageKey, storageKey2, storageKey3, transformedPhotoData1, transformedPhotoData2, transformedPhotoData3, image, outputFilePathGray, outputFilePathBlurred, outputFilePathXXXX) {
  
  //B/W photos
  const params = { Bucket: bucketName, Key: storageKey };
  try {
    const s3Result = await s3.getObject(params).promise();
    if (s3Result) {
      // The object exists in S3, so you can serve it directly
      const s3URL = `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${storageKey}`;
        transformedPhotoData1.push({ storageKey, s3URL });
        console.log('Photo: ',storageKey,'is fetched from S3');
      }
    } catch (err) {
    if (err.statusCode === 404) {
      // Generate new image
      const util = require('util');
      const execPromised = util.promisify(exec);

      try {
        const start_transform_time_bw = process.hrtime();  // Capture start time for B/W transformation
        await execPromised(`magick convert ${image} -colorspace LinearGray ${outputFilePathGray}`);
        const end_transform_time_bw = process.hrtime(start_transform_time_bw);  // Capture end time for B/W transformation

        // Calculate the duration in milliseconds for B/W transformation
        const duration_bw = (end_transform_time_bw[0] * 1e9 + end_transform_time_bw[1]) / 1e6;
        totalTransformationTimeBW += Math.round(duration_bw, 2);  // Update total transformation time for B/W images

        const data = await fs.promises.readFile(outputFilePathGray);
        await uploadToS3AndStoreInList(data, storageKey, bucketName, transformedPhotoData1);

        await deleteLocalFile(outputFilePathGray);
      } catch (error) {
        console.error('Error during image transformation or S3 upload:', error);
      }
    }
  }

  //Blurred photos
  const params2 = { Bucket: bucketName, Key: storageKey2 };
  try {
    const s3Result2 = await s3.getObject(params2).promise();
    if (s3Result2) {
      // The object exists in S3, so you can serve it directly
      const s3URL = `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${storageKey2}`;
        transformedPhotoData2.push({ storageKey2, s3URL });
        console.log('Photo: ',storageKey2,'is fetched from S3');
      }
    } catch (err) {
    if (err.statusCode === 404) {
      // Generate new image
      const util = require('util');
      const execPromised = util.promisify(exec);  

      try {
        //TODO: Likte egentlig denne ganske bra
        const start_transform_time_sig = process.hrtime();  // Capture start time for Blurred transformation
        await execPromised(`magick convert ${image} -brightness-contrast -10x10 -modulate 120,90 ${outputFilePathBlurred}`);
        //await execPromised(`magick convert ${image} -sigmoidal-contrast 15x30% -modulate 50 ${outputFilePathBlurred}`);

        await execPromised(`magick convert ${outputFilePathBlurred} -sparse-color Barycentric '0,0 black 0,%h white' -function polynomial 4,-4,1 blurmap-${outputFilePathBlurred}`);
        await execPromised(`magick convert ${outputFilePathBlurred} blurmap-${outputFilePathBlurred} -compose Blur -set option:compose:args 10 -composite composite-${outputFilePathBlurred}`);
        
        const end_transform_time_sig = process.hrtime(start_transform_time_sig);  // Capture end time for Blurred transformation
        
        // Calculate the duration in milliseconds for Blurred transformation
        const duration_sig = (end_transform_time_sig[0] * 1e9 + end_transform_time_sig[1]) / 1e6;
        totalTransformationTimeBlurred += Math.round(duration_sig, 2); 
        
        const Blurred_filepath = `composite-${outputFilePathBlurred}`;

        const data = await fs.promises.readFile(Blurred_filepath);
        await uploadToS3AndStoreInList(data, storageKey2, bucketName, transformedPhotoData2);
        
        await deleteLocalFile(Blurred_filepath);
        await deleteLocalFile(outputFilePathBlurred);
        await deleteLocalFile(`blurmap-${outputFilePathBlurred}`);


      } catch (error) {
        console.error('Error during image transformation or S3 upload:', error);
      }
    } else {
      console.log('Something went wrong');
    }
  }


  //TODO: Legge inn nytt filter (XXXX)
  const params3 = { Bucket: bucketName, Key: storageKey3 };
  try {
    const s3Result3 = await s3.getObject(params3).promise();
    if (s3Result3) {
      // The object exists in S3, so you can serve it directly
      const s3URL = `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${storageKey3}`;
        transformedPhotoData3.push({ storageKey3, s3URL });
        console.log('Photo: ',storageKey3,'is fetched from S3');
      }
    } catch (err) {
    if (err.statusCode === 404) {
      // Generate new image
      const util = require('util');
      const execPromised = util.promisify(exec);

      try {
        const start_transform_time_XXXX = process.hrtime();  // Capture start time for XXXX transformation
        await execPromised(`magick convert ${image} -brightness-contrast -10x10 -modulate 110,110 ${outputFilePathXXXX}`);
        const end_transform_time_XXXX = process.hrtime(start_transform_time_XXXX);  // Capture end time for XXXX transformation

        // Calculate the duration in milliseconds for XXXX transformation
        const duration_XXXX = (end_transform_time_XXXX[0] * 1e9 + end_transform_time_XXXX[1]) / 1e6;
        totalTransformationTimeXXXX += Math.round(duration_XXXX, 2);  // Update total transformation time for XXXX images

        const data = await fs.promises.readFile(outputFilePathXXXX);
        await uploadToS3AndStoreInList(data, storageKey3, bucketName, transformedPhotoData3);

        await deleteLocalFile(outputFilePathXXXX);
      } catch (error) {
        console.error('Error during image transformation or S3 upload:', error);
      }
    }
  }
}  


function isNewDay(lastSavedDay) {
  // Create a Date object for the current date
  const currentDate = new Date();

  // Extract the day, month, and year from the current date
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Extract the day, month, and year from the lastSavedDay
  const savedDay = lastSavedDay.getDate();
  const savedMonth = lastSavedDay.getMonth();
  const savedYear = lastSavedDay.getFullYear();

  return (
    currentYear !== savedYear ||
    currentMonth !== savedMonth ||
    currentDay !== savedDay
  );
}