const AWS = require('aws-sdk/global');
const S3 = require('aws-sdk/clients/s3');
const Cloudfront = require('aws-sdk/clients/cloudfront');

const fs =  require('fs');
const glob = require("glob");

const config = require('../config/deploy_config.js');

// const credentials = new AWS.Credentials(config.accessKeyId, config.secretAccessKey);

AWS.config.logger = console;

const s3 = new S3({
  region: config.region,
  params: {
    Bucket: config.bucketName
  }
});

const cloudfront = new Cloudfront({
  region: config.region
});

const getFilesListFromBasket = new Promise((resolve, reject) => {
  s3.listObjects().promise().then(data => {
    resolve(data);
  }).catch(err => {
    reject(err);
  })
});



//Remove old files
getFilesListFromBasket.then(data => {
  let paramsDeleteObjects = {
    Delete: {
      Objects: [],
      Quiet: false
    }
  };

  const removeFilesFromBasketPromise = new Promise((resolve, reject) => {
    if(data.Contents.length > 0) {
      data.Contents.forEach(file => {
        paramsDeleteObjects.Delete.Objects.push({
          Key: file.Key
        });
      });

      s3.deleteObjects(paramsDeleteObjects).promise().then(data => {
        resolve();
      }).catch(err => {
        reject();
      });
    } else {
      resolve();
    }
  });

  removeFilesFromBasketPromise.then(() => {

    //Prepare files list
    const files = [
      {
        name: './build_webpack/index.html',
        key: 'index.html',
        contentType: 'text/html',
        cacheControl: 'no-cache'
      },
      {
        name: './build_webpack/favicon.ico',
        key: 'favicon.ico',
        contentType: 'text/html',
        cacheControl: 'no-cache'
      }
    ];

    glob.sync("./build_webpack/static/js/*.js").forEach(file => {
      files.push({
        name: file,
        key: file.replace(/.\/build_webpack\//, ''),
        contentType: 'application/javascript',
        cacheControl: 'no-cache'
      });
    });


    //Read and upload files to s3
    let filesPromises = [];

    files.forEach(file => {
      const promise = new Promise((resolve, reject) => {
        fs.readFile(file.name, (err, data) => {
          let params = {
            Key: file.key,
            Body: data,
            ContentType: file.contentType,
            CacheControl: file.cacheControl
          };
          s3.putObject(params).promise().then(data => {
              resolve();
          }).catch(error => {
            reject(error);
          });
        });
      });
      filesPromises.push(promise);
    });

    //Invalidate cloud front cache
    Promise.all(filesPromises).then(() => {
      console.log('All files uploaded');

      const params = {
        DistributionId: config.cloudFrontDistributionID,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: 1,
            Items: [
              '/*'
            ]
          }
        }
      };

      cloudfront.createInvalidation(params).promise().then(data => {
        console.log('Invalidation success');
        console.log(data);
      }).catch(err => {
        console.log('Invalidation error:');
        console.log(err);
      });
    }).catch(error => {
      console.log('Error while upload files:');
      console.log(error);
    });

  }).catch(error => {
    console.log('Error deleting files:');
    console.log(error);
  });
});