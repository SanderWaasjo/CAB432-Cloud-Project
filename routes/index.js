var express = require('express');
var router = express.Router();
const { exec } = require('child_process');
const multer = require('multer');
const redis = require('redis');
require('dotenv').config();
const AWS = require('aws-sdk');
const app = express();
const fs = require('fs');


//Setting up the redis connection
const redisClient = redis.createClient({
  host: 'localhost', 
  port: 6379,        
});

redisClient.connect()
	.catch((err) => {
		console.log(err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis Error:', err);
});

//Setting the AWS config variables based on the innputed env variables
const region = 	'ap-southeast-2';
AWS.config.update({
	accessKeyId: process.env.aws_access_key_id,
	secretAccessKey: process.env.aws_secret_access_key,
	sessionToken: process.env.aws_session_token,
	region: region,
});


//S3 bucket setup
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


// Multer logic for uploading photos to instance
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); 
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });


//Post logic for handlig the upload of photos from user
router.post('/', upload.array('photo'), async (req, res) => {
  const uploadedFiles = req.files || [];
  const transformedPhotoDataBW = [];
  const transformedPhotoDataBlurred = [];
  const transformedPhotoDataEnhanced = [];
  const s3_promises = [];

  //Logic for process the input photos
  async function processFile(file) {
    const uploadedFilePath = file.path;
    const outputFilePathGray = `uploads-gray/gray-${file.filename}`;
    const outputFilePathBlurred = `uploads-Blurred/${file.filename}`;
    const outputFilePathEnhanced = `uploads-Enhanced/${file.filename}`;
    const storageKeyGray = `gray-${file.filename}`;
    const storageKeyBlurred = `Blurred-${file.filename}`;
    const storageKeyEnhanced = `Enhanced-${file.filename}`;
  
    s3_promises.push(checkS3BucketAndGenerateNewImage(bucketName, storageKeyGray, storageKeyBlurred, storageKeyEnhanced, transformedPhotoDataBW, transformedPhotoDataBlurred, transformedPhotoDataEnhanced, uploadedFilePath, outputFilePathGray, outputFilePathBlurred, outputFilePathEnhanced));
  }
  

  // Process each uploaded file in parallel
  await Promise.all(uploadedFiles.map(processFile));
  await Promise.all(s3_promises);

  //Logic for deleting temp stored photos during processing
  await fs.readdir('uploads', (err, files) => {
    if (err) {
      console.error(err);
      return;
    }
    for (const file of files) {
      deleteLocalFile(`uploads/${file}`);
    }
  });


   // Logic for fetching the last saved day from Redis
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
  
  //Console logging for ensuring the variables are changes properly
  console.log('Total number of uploads:', totalUploadCount);
  console.log('Total transformation time for B/W images:', totalTransformationTimeBW);
  console.log('Total transformation time for Blurred images:', totalTransformationTimeBlurred);
  console.log('Total transformation time for Enhanced images:', totalTransformationTimeEnhanced);


  //Rendering of variables to the frontend 
  res.render('index', {
    uploadTransformedPhotosBW: transformedPhotoDataBW,
    uploadTransformedPhotosBlurred: transformedPhotoDataBlurred,
    uploadTransformedPhotosEnhanced: transformedPhotoDataEnhanced,
    totalTransformationTimeBW,
    totalTransformationTimeBlurred,
    totalTransformationTimeEnhanced,
    totalUploadCount
    });
});


//Logic for when loading the application at first
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

//Deleting temp stored local files
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
let totalTransformationTimeEnhanced = 0;

//Function for checking the S3 bucket for already transformed photos, or we generate a new image based on the API response
async function checkS3BucketAndGenerateNewImage(bucketName, storageKey, storageKey2, storageKey3, transformedPhotoData1, transformedPhotoData2, transformedPhotoData3, image, outputFilePathGray, outputFilePathBlurred, outputFilePathEnhanced) {
  
  //BW photos
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
        const start_transform_time_bw = process.hrtime(); 

        await execPromised(`magick convert ${image} -colorspace LinearGray ${outputFilePathGray}`);
        
        const end_transform_time_bw = process.hrtime(start_transform_time_bw); 
        const duration_bw = (end_transform_time_bw[0] * 1e9 + end_transform_time_bw[1]) / 1e9;
        totalTransformationTimeBW += duration_bw.toFixed(2);

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
        const start_transform_time_blurred = process.hrtime();

        await execPromised(`magick convert ${image} -brightness-contrast -10x10 -modulate 120,90 ${outputFilePathBlurred}`);
        await execPromised(`magick convert ${outputFilePathBlurred} -sparse-color Barycentric '0,0 black 0,%h white' -function polynomial 4,-4,1 blurmap-${outputFilePathBlurred}`);
        await execPromised(`magick convert ${outputFilePathBlurred} blurmap-${outputFilePathBlurred} -compose Blur -set option:compose:args 10 -composite composite-${outputFilePathBlurred}`);
        
        const end_transform_time_blurred = process.hrtime(start_transform_time_blurred);
        const duration_blurred= (end_transform_time_blurred[0] * 1e9 + end_transform_time_blurred[1]) / 1e9;
        totalTransformationTimeBlurred+= duration_blurred.toFixed(2); 
        
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


  //Enhanced coloring of photos
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
        const start_transform_time_Enhanced = process.hrtime();  

        await execPromised(`magick convert ${image} -brightness-contrast -10x10 -modulate 110,110 ${outputFilePathEnhanced}`);
        
        const end_transform_time_Enhanced = process.hrtime(start_transform_time_Enhanced); 
        const duration_Enhanced = (end_transform_time_Enhanced[0] * 1e9 + end_transform_time_Enhanced[1]) / 1e9;
        totalTransformationTimeEnhanced += duration_Enhanced.toFixed(2);

        const data = await fs.promises.readFile(outputFilePathEnhanced);
        await uploadToS3AndStoreInList(data, storageKey3, bucketName, transformedPhotoData3);

        await deleteLocalFile(outputFilePathEnhanced);
      } catch (error) {
        console.error('Error during image transformation or S3 upload:', error);
      }
    }
  }
}  

//Function for checking for new day
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
