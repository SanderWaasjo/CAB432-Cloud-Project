//Fungerende flicker henting av bilder på to måter

/* GET home page. */
//Just show the 100 golden retrievers when accessing localhos:3000
router.get("/", async function (req, res) {
	const FLICKR_API_KEY = "0281e7ba446aeddb532c063164a09523";
  /*  const FLICKR_API_KEY = process.env.API_KEY;*/
  
	const response = await fetch(
	  `https://api.flickr.com/services/rest?method=flickr.photos.search&api_key=${FLICKR_API_KEY}&tags=golden-retriever&per-page=50&format=json&nojsoncallback=1&media=photos`
	);
	const data = await response.json();
	const photos = data.photos;
  
	const formattedPhotoData = [];
  
	for (let i = 0; i < photos.photo.length; i++) {
	  const photo = photos.photo[i];
	  const image = `http://farm${photo.farm}.static.flickr.com/${photo.server}/${photo.id}_${photo.secret}_t.jpg`;
	  const url = `http://www.flickr.com/photos/${photo.owner}/${photo.id}`;
	  const title = photo.title;
	  formattedPhotoData.push({ image, url, title });
	}
  
	res.render("index", { formattedPhotoData });
  });
  
  
  //To be able to search for a given thing in the URL
  //For example localhost:3000/dog/10 for searching for 10 dogs
  router.get('/:query/:number', (req, res) => {
	const query = req.params.query; // The search query (e.g., "golden-retriever")
	const number = req.params.number; // The number of results to fetch
  
  
	const options = createFlickrOptions(query, number, FLICKR_API_KEY);
	const url = `https://${options.hostname}${options.path}`;
  
	axios.get(url)
	  .then((response) => {
		res.writeHead(response.status, { 'content-type': 'text/html' });
		return response.data;
	  })
	  .then((rsp) => {
		const s = parsePhotoRsp(rsp);
		res.write(s);
		res.end();
	  })
	  .catch((error) => {
		console.error(error);
		res.status(500).send('An error occurred.');
	  });





// Function to display formatted photos
function displayFormattedPhotos(photosData) {
	const formattedPhotosDiv = document.getElementById('formatted-photos');
	formattedPhotosDiv.innerHTML = '';
  
	photosData.forEach((photo) => {
	  const imgElement = document.createElement('img');
	  imgElement.src = `/newphotos/${photo.filename}`; // Replace with actual path
	  imgElement.alt = photo.filename;
	  formattedPhotosDiv.appendChild(imgElement);
	});
	formattedPhotosDiv.style.display = 'block';
  }
  
  // Function to handle file upload and processing
  async function handleFileUpload() {
	const formData = new FormData(document.getElementById('upload-form'));
  
	// Use the Fetch API to upload files and get the processing status
	try {
	  const response = await fetch('/', {
		method: 'POST',
		body: formData,
	  });
	  
	  if (response.ok) {
		const data = await response.json();
		if (data.message === 'Files uploaded successfully') {
		  // Files uploaded, check processing status
		  checkProcessingStatus();
		}
	  }
	} catch (error) {
	  console.error('Error:', error);
	}
  }
  
  // Function to check processing status and display formatted photos
  async function checkProcessingStatus() {
	const response = await fetch('/newphotos');
	const data = await response.json();
  
	if (data.allComplete) {
	  // Processing is complete, display formatted photos
	  displayFormattedPhotos(data.files);
	} else {
	  // Processing is still pending, continue checking
	  setTimeout(checkProcessingStatus, 1000); // Check again after 1 second
	}
  }
  
  // Add a click event listener to the upload button
  document.getElementById('upload-button').addEventListener('click', handleFileUpload);
  
  // Call the function when the page loads
  checkProcessingStatus();



  exec(`magick convert ${image} -colorspace LinearGray ${outputFilePath}`, async (error, stdout, stderr) => {
	if (error) {
	  console.error(`Error: ${error.message}`);
	  return;
	}
	if (stderr) {
	  console.error(`stderr: ${stderr}`);
	  return;
	}
	console.log(`Photo transformed to: ${outputFilePath}`);

	const processedData = {
	  message: 'File uploaded and processed successfully',
	  //files: uploadedFilesInfo,
	  processedImagePath: outputFilePath,
	};













  });
  
  function createFlickrOptions(query, number, apiKey) {
	const options = {
	  hostname: 'api.flickr.com',
	  port: 443,
	  path: '/services/rest/?',
	  method: 'GET',
	};
	const str = `method=flickr.photos.search&api_key=${apiKey}&tags=${query}&per_page=${number}&format=json&media=photos&nojsoncallback=1`;
	options.path += str;
	return options;
  }
  
  // Various font sizes used to fit URL on screen
  function parsePhotoRsp(rsp) {
	let s = "";
	for (let i = 0; i < rsp.photos.photo.length; i++) {
	  const photo = rsp.photos.photo[i];
	  const t_url = `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_t.jpg`;
	  const p_url = `https://www.flickr.com/photos/${photo.owner}/${photo.id}`;
	  s += `<a href="${p_url}"><img alt="${photo.title}" src="${t_url}"/></a>`;
	}
	return s;
  }





  //prøvde på å sjekke om redis cach resultatet var good.
      if (result){
      console.log('test1');
      const params = { Bucket: bucketName, Key: s3storageKeyKey };
      try {
        const s3Result = await s3.getObject(params).promise();
        const fileData = s3Result.Body.toString('utf-8');
        formattedPhotoData.push({fileData})
      } catch(err){
        if (err.statusCode === 404) {
        // TODO: Putt inn logikk for transformering og lagring til S3
          exec(`magick convert ${image} -colorspace LinearGray ${outputFilePath}`, async (error, stdout, stderr) => {
            if (error) {
              console.error(`Error: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`stderr: ${stderr}`);
              return;
            }
            console.log(`Photo transformed to: ${outputFilePath}`);
            fetch(`./newphotos/${formatName}`)
            .then((res) => {
              const data = res.body.toString('utf-8')		
              const objectParams = { Bucket: bucketName, Key: storageKey, Body: data };
              s3.putObject(objectParams)
              .promise()
              .then(() => {
                console.log(
                `Successfully uploaded data to ${bucketName}/${storageKey}`
                );
              })
              redisClient.set(storageKey, JSON.stringify({ source: "Redis Cache", ...data }), 'EX', 3600);
            })
            });
        // TODO: Logikk for lagring til redis Cache
        }; 
    } 
  }else {
      // TODO: Logikk hvis key ikke finnes i redis cache
      console.log('test2');
      const params = { Bucket: bucketName, Key: storageKey };
      try {
        const s3Result = await s3.getObject(params).promise();
        const fileData = s3Result.Body.toString('utf-8');
        transformedPhotoData.putObject({fileData})
      } catch(err){
        exec(`magick convert ${image} -colorspace LinearGray ${outputFilePath}`, async (error, stdout, stderr) => {
          if (error) {
            console.error(`Error: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
          }
          console.log(`Photo transformed to: ${outputFilePath}`);
          fetch(`./newphotos/${formatName}`)
          .then((res) => {
            const data = res.body.toString('utf-8')		
            const objectParams = { Bucket: bucketName, Key: storageKey, Body: data };
            s3.putObject(objectParams)
            .promise()
            .then(() => {
              console.log(
              `Successfully uploaded data to ${bucketName}/${storageKey}`
              );
            })
            redisClient.set(storageKey, JSON.stringify({ source: "Redis Cache", ...data }), 'EX', 3600);
          })
          .catch((err) => res.status(500).send('An error occurred'));
          });
      }
    }
  } 
  // }};




  res.render("index", {
    formattedPhotoData, 
    searchQuery: query, 
    maxPhotos,
    page,
    transformedPhotoData,
  });
});







//TODO: Denne fungerte ganske bra

//------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//Logikk for å transofremere bilder lokalt ikke med S3
// Denne funker lokalt, må få den til å funke på serveren
// router.post('/', upload.array('photo'), async (req, res) => {
//   const uploadedFiles = req.files || [];
//   const uploadedFilesInfo = [];

//   const s3_proimises = [];

//   async function processFile(file) {
//     const uploadedFilePath = file.path;
//     console.log(`File uploaded successfully: ${uploadedFilePath}`);

//     uploadedFilesInfo.push({
//       filename: file.filename,
//       path: uploadedFilePath,
//     });

//     const outputFilePath = `uploads-gray/gray-${file.filename}`;
    
//     const redisKey = `${file.filename}`;
//     const result = await redisClient.get(redisKey);

//     if (!result) {
//       // If not in cache, create and store processed data
//       exec(`magick convert ${uploadedFilePath} -colorspace LinearGray ${outputFilePath}`, async (error, stdout, stderr) => {
//         if (error) {
//           console.error(`Error: ${error.message}`);
//           return;
//         }
//         if (stderr) {
//           console.error(`stderr: ${stderr}`);
//           return;
//         }
//         console.log(`Photo transformed to: ${outputFilePath}`);

//         const processedData = {
//           message: 'File uploaded and processed successfully',
//           files: uploadedFilesInfo,
//           processedImagePath: outputFilePath,
//         };

//         await redisClient.set(redisKey, 3600, JSON.stringify(processedData));
//       });
//     }
//   }

//   // Process each uploaded file in parallel
//   await Promise.all(uploadedFiles.map(processFile));

//   // Fetch processed photos data from Redis and render the index template with the data
//   const processedPhotosData = await Promise.all(
//     uploadedFiles.map(async (file) => {
//       const redisKey = `${file.filename}`;
//       const result = await redisClient.get(redisKey);
//       return JSON.parse(result || '{}');
//     })
//   );

//   res.render("index", { processedPhotos: processedPhotosData });
// });























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
const async = require('hbs/lib/async');








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

  await fs.readdir('uploads', (err, files) => {
    if (err) {
      console.error(err);
      return;
    }
    for (const file of files) {
      deleteLocalFile(`uploads/${file}`);
    }
  });


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
async function uploadToS3AndStoreInList(data, storageKey, bucketName, transformedPhotoData) {
  const s3Params = { Bucket: bucketName, Key: storageKey, Body: data };
  try {
    await s3.putObject(s3Params).promise();
    console.log(`Successfully uploaded data to ${bucketName}${storageKey}`);
    s3.presig
    const s3URL = `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${storageKey}`;

    transformedPhotoData.push({ storageKey, s3URL });
    //console.log(transformedPhotoData);
  } catch (err) {
    console.log('Something went wrong when accessing the S3 bucket:', err);
  }
}

async function tempUploadToS3(data, storageKey, bucketName) {
  const s3Params = { Bucket: bucketName, Key: storageKey, Body: data };
  try {
    await s3.putObject(s3Params).promise();
    console.log(`Successfully uploaded data to ${bucketName}${storageKey}`);
    const s3URL = `https://${bucketName}.s3.ap-southeast-2.amazonaws.com/${storageKey}`;  
    return s3URL;

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
    console.log('File deleted successfully');
  });
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
        await uploadToS3AndStoreInList(data, storageKey, bucketName, transformedPhotoData1);
        await deleteLocalFile(outputFilePathGray);
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
        const tempSigmodialData = await fs.promises.readFile(outputFilePathSigmodial);
        const tempSigmodialS3URL = await tempUploadToS3(tempSigmodialData,`tempSigmodial-${storageKey2}`,bucketName);
        await deleteLocalFile(outputFilePathSigmodial);

        await execPromised(`magick convert ${tempSigmodialS3URL} -sparse-color Barycentric '0,0 black 0,%h white' -function polynomial 4,-4,1 blurmap-${outputFilePathSigmodial}`);
        const tempBlurData = await fs.promises.readFile(`blurmap-${outputFilePathSigmodial}`);
        const tempBlurS3URL = await tempUploadToS3(tempBlurData,`tempBlur-${storageKey2}`,bucketName);
        await deleteLocalFile(`blurmap-${outputFilePathSigmodial}`);

        await execPromised(`magick convert ${tempSigmodialS3URL} ${tempBlurS3URL} -compose Blur -set option:compose:args 10 -composite composite-${outputFilePathSigmodial}`);
        const sigmodial_filepath = `composite-${outputFilePathSigmodial}`;

        const data = await fs.promises.readFile(sigmodial_filepath);
        await uploadToS3AndStoreInList(data, storageKey2, bucketName, transformedPhotoData2);
        await deleteLocalFile(sigmodial_filepath);

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



