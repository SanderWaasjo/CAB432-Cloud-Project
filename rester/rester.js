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
