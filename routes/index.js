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


const { S3RequestPresigner, getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { Hash } = require('@smithy/hash-node');
const { S3client, GetObjectCommand} = require("@aws-sdk/client-s3");








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
	region: "ap-southeast-2",
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



// Create an S3 Request Presigner
const signer = new S3RequestPresigner({
  credentials: s3.config.credentials,
  sha256: Hash.bind(null, 'sha256'),
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
  const transformedPhotoDataSigmodial = [];

  const s3_promises = [];

  async function processFile(file) {
    const uploadedFilePath = file.path;
    const outputFilePathGray = `uploads-gray/gray-${file.filename}`;
    const outputFilePathSigmodial = `uploads-sigmodial/${file.filename}`;
    const storageKeyGray = `gray-${file.filename}`;
    const storageKeySigmodial = `sigmodial-${file.filename}`;
    const result = await redisClient.get(storageKeyGray);

    if (!result) {
      s3_promises.push(checkS3BucketAndGenerateNewImage(bucketName, storageKeyGray, storageKeySigmodial, transformedPhotoDataBW, transformedPhotoDataSigmodial, uploadedFilePath, outputFilePathGray, outputFilePathSigmodial));
    }
  }

  // Process each uploaded file in parallel
  await Promise.all(uploadedFiles.map(processFile));
  await Promise.all(s3_promises);

  res.render('index', {
    uploadTransformedPhotosBW: transformedPhotoDataBW,
    uploadTransformedPhotosSigmodial: transformedPhotoDataSigmodial,
  });
});






//Fetching Timing Data from Redis:
async function fetchTimingData(storageKey) {
  try {
    const timingKey = `timing-${storageKey}`;
    const timingData = await redisClient.get(timingKey);
    return timingData;
  } catch (err) {
    console.error('Error fetching timing data from Redis:', err);
  }
}



  router.get("/", async function (req, res) {
    res.render('index', {
      
    });
  });

  module.exports = router;


//Function for uploading to the S3 bucket
async function uploadToS3(data, storageKey, bucketName, transformedPhotoData) {
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


//Function for checking the S3 bucket for already transformed photos, or we generate a new image based on the API response
async function checkS3BucketAndGenerateNewImage(bucketName, storageKey, storageKey2, transformedPhotoData1, transformedPhotoData2, image, outputFilePathGray, outputFilePathSigmodial) {
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
        await execPromised(`magick convert ${image} -colorspace LinearGray ${outputFilePathGray}`);

        //console.log(`Photo transformed to: ${outputFilePath}`);
        const data = await fs.promises.readFile(outputFilePathGray);
        await uploadToS3(data, storageKey, bucketName, transformedPhotoData1);
      } catch (error) {
        console.error('Error during image transformation or S3 upload:', error);
      }
    }
  }

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
      
      //Logic for converting the image to sigmodial - this is the one taking a lot of time
      try {
        await execPromised(`magick convert ${image} -sigmoidal-contrast 15x30% -modulate 50 ${outputFilePathSigmodial}`);
        await execPromised(`magick convert ${outputFilePathSigmodial} -sparse-color Barycentric '0,0 black 0,%h white' -function polynomial 4,-4,1 blurmap-${outputFilePathSigmodial}`);
        await execPromised(`magick convert ${outputFilePathSigmodial} blurmap-${outputFilePathSigmodial} -compose Blur -set option:compose:args 10 -composite composite-${outputFilePathSigmodial}`);
        const sigmodial_filepath = `composite-${outputFilePathSigmodial}`;

        const data = await fs.promises.readFile(sigmodial_filepath);
        await uploadToS3(data, storageKey2, bucketName, transformedPhotoData2);

      } catch (error) {
        console.error('Error during image transformation or S3 upload:', error);
      }
      
    } else {
      console.log('Something went wrong');
    }
  }
}





            // try {
      //   //TODO: Likte egentlig denne ganske bra
      //   await execPromised(`magick convert ${image} -brightness-contrast -10x10 -modulate 120,90 composite-${outputFilePathSigmodial}`);

      //   const sigmodial_filepath = `composite-${outputFilePathSigmodial}`;

      //   const data = await fs.promises.readFile(sigmodial_filepath);
      //   await uploadToS3(data, storageKey2, bucketName, transformedPhotoData2);

      // } catch (error) {
      //   console.error('Error during image transformation or S3 upload:', error);
      // }