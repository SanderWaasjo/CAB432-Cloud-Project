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
const FLICKR_API_KEY = process.env.FLICKR_API_KEY;


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
    const redisKeyGray = `gray-${file.filename}`;
    const redisKeySigmodial = `sigmodial-${file.filename}`;
    const result = await redisClient.get(redisKeyGray);

    if (!result) {
      s3_promises.push(checkS3BucketAndGenerateNewImage(bucketName, redisKeyGray, redisKeySigmodial, transformedPhotoDataBW, transformedPhotoDataSigmodial, uploadedFilePath, outputFilePathGray, outputFilePathSigmodial));
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











  router.get("/", async function (req, res) {
    const query = req.query.query;
    const maxPhotos = req.query.maxPhotos; 

    const response = await fetch(
      `https://api.flickr.com/services/rest?method=flickr.photos.search&api_key=${FLICKR_API_KEY}&tags=${query}&per-page=${maxPhotos}&format=json&nojsoncallback=1&media=photos`
    );
    const data = await response.json();
    const page = Math.floor(Math.random() * data.photos.pages);
    
    //Fjerne når jeg får det til å fungere
    console.log(page);

    const randomPageResponse = await fetch(
      `https://api.flickr.com/services/rest?method=flickr.photos.search&api_key=${FLICKR_API_KEY}&tags=${query}&per-page=${maxPhotos}&format=json&nojsoncallback=1&media=photos&page=${page}`
    );
    const randomPageData = await randomPageResponse.json();
    const photos = randomPageData.photos;

    const formattedPhotoData = [];
    const transformedPhotoData1 = [];
    const transformedPhotoData2 = [];
    const transformedPhotoDataRedis = [];

    const operations = []; // We'll store our promises here

    for (let i = 0; i < maxPhotos; i++) {
      const photo = photos.photo[i];
      const image = `https://farm${photo.farm}.static.flickr.com/${photo.server}/${photo.id}_${photo.secret}_t.jpg`;
      const url = `http://www.flickr.com/photos/${photo.owner}/${photo.id}`;
      const title = photo.title;
      const formatName = `farm${photo.farm}_${photo.server}_${photo.id}_${photo.secret}_t.jpg`;
      formattedPhotoData.push({ image, url, title });
      
      const outputFilePath = `newphotos/${formatName}`;
      
      const storageKey = `${formatName}`;
      const storageKey2 = `2${formatName}`;

      const result = await redisClient.get(storageKey);
      
      if(result){
        //Serve from Redis cache and append to transformedPhotoData

        //RedisResult is in base 64, convert to image and append to transformedPhotoDataRedis
        const redisResult = await redisClient.get(storageKey)
        // var redisImage = new Image();
        // image.src = redisResult;
        transformedPhotoDataRedis.push({storageKey, redisResult});
        
      }else{
        //Checking S3 bucket or generate new image based on API response
        operations.push(checkS3BucketAndGenerateNewImage(bucketName, storageKey, storageKey2, transformedPhotoData1, transformedPhotoData2, image, outputFilePath));
      }
      }
      
    
    await Promise.all(operations);
    res.render("index", {
      formattedPhotoData,
      searchQuery: query,
      maxPhotos,
      page,
      transformedPhotoData1,
      transformedPhotoData2,
      transformedPhotoDataRedis,
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

//Function for storing in the Redis Cache
async function storeInRedisCache(body, storageKey){
  const img64Base = body.toString('base64');
  redisClient.setEx(storageKey, 3600, img64Base);
}



//TODO: Denne fungerer, men klarer ikke vise fra S3

//Function for checking the S3 bucket for already transformed photos, or we generate a new image based on the API response
async function checkS3BucketAndGenerateNewImage(bucketName, storageKey, storageKey2, transformedPhotoData1, transformedPhotoData2, image, outputFilePathGray, outputFilePathSigmodial) {
  const params = { Bucket: bucketName, Key: storageKey };
  try {
    const s3Result = await s3.getObject(params).promise();

    const s3URL = `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${storageKey}`;


    transformedPhotoData1.push({ storageKey, s3URL });
    console.log(transformedPhotoData1);
    await storeInRedisCache(body, storageKey);

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
        await storeInRedisCache(data, storageKey);

      } catch (error) {
        console.error('Error during image transformation or S3 upload:', error);
      }


      // try {
      //   await execPromised(`magick convert ${image} -sigmoidal-contrast 15x30% -modulate 50 ${outputFilePathSigmodial}`);
      //   await execPromised(`magick convert ${outputFilePathSigmodial} -sparse-color Barycentric '0,0 black 0,%h white' -function polynomial 4,-4,1 blurmap-${outputFilePathSigmodial}`);
      //   await execPromised(`magick convert ${outputFilePathSigmodial} blurmap-${outputFilePathSigmodial} -compose Blur -set option:compose:args 10 -composite composite-${outputFilePathSigmodial}`);
      //   const sigmodial_filepath = `composite-${outputFilePathSigmodial}`;

      //   const data = await fs.promises.readFile(sigmodial_filepath);
      //   await uploadToS3(data, storageKey2, bucketName, transformedPhotoData2);
      //   await storeInRedisCache(data, storageKey2);

      // } catch (error) {
      //   console.error('Error during image transformation or S3 upload:', error);
      // }



      try {
        //TODO: Likte egentlig denne ganske bra
        await execPromised(`magick convert ${image} -brightness-contrast -10x10 -modulate 120,90 composite-${outputFilePathSigmodial}`);



        const sigmodial_filepath = `composite-${outputFilePathSigmodial}`;

        const data = await fs.promises.readFile(sigmodial_filepath);
        await uploadToS3(data, storageKey2, bucketName, transformedPhotoData2);
        await storeInRedisCache(data, storageKey2);

      } catch (error) {
        console.error('Error during image transformation or S3 upload:', error);
      }


    } else {
      console.log('Something went wrong');
    }
  }
}



