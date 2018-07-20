'use strict';

const AWS = require('aws-sdk');
const AWSCognitoIdentity = require('amazon-cognito-identity-js');
const AWSParameters = require('../../web/awsparameters.js');
const AWSCognitoAuth = require('amazon-cognito-auth-js');
const bis_genericio = require('bis_genericio.js');
const bisweb_image = require('bisweb_image.js');
const bis_webutil = require('bis_webutil.js');
const wsutil = require('../../fileserver/wsutil.js');
const bisweb_filedialog = require('bisweb_filedialog.js');
const $ = require('jquery');

class AWSModule {

    constructor() {
        AWS.config.update({
            'region' : AWSParameters.RegionName,
            'credentials' : new AWS.CognitoIdentityCredentials({
                'IdentityPoolId' : AWSParameters.IdentityPoolId
            })
        });

        //AWSCognitoIdentity.config.region = this.regionName;

        const userPoolData = {
            'UserPoolId' : AWSParameters.authParams.UserPoolId,
            'ClientId' : AWSParameters.authParams.ClientId
        };

        this.userPool = new AWSCognitoIdentity.CognitoUserPool(userPoolData);
        this.userData = {
            'username' : null,
            'pool' : null
        };

        this.authData = AWSParameters.authParams;

        this.awsAuth = null;
        this.s3 = this.createS3(AWSParameters.BucketName);
        //this.listObjectsInBucket();

        //set to the values provided by Cognito when the user signs in
        this.cognitoUser = null;

        //UI features
        this.createUserModal = null;
        this.authUserModal = null;

        window.addEventListener('message', (data) => {
            console.log('got a message', data); 
        });

        //file display modal gets deleted if you try to load it too soon
        //not completely sure why -Zach
        bis_webutil.runAfterAllLoaded( () => {   
            this.fileDisplayModal = new bisweb_filedialog('Bucket Contents');
            //fileListFn won't get called from wihin filedialog because the bucket is a flat storage structure
            this.fileDisplayModal.fileRequestFn = this.makeRequest.bind(this);
        });

    }

    createS3(bucketName, credentials = null, session_token = null) {
        let s3 = new AWS.S3({
            'apiVersion' : '2006-03-01',
            'credentials' : credentials,
            'sessionToken' : session_token,
            'params' : { Bucket : bucketName}
        });

        return s3;
    }

    listObjectsInBucket() {
        this.s3.listObjects({ 'Delimiter' : '/'}, (err, data) => {
            if (err) { console.log('an error occured', err); return; }
            console.log('got objects', data);

            //format list data to a format that file display modal can understand...
            let list = [];
            for (let entry of data.Contents) {
                let newEntry = {};
                newEntry.text = entry.Key;
                newEntry.path = entry.Key;

                let fileType = newEntry.text.split('.');
                switch(fileType[fileType.length - 1]){
                    case 'gz' : (fileType[fileType.length - 2] === 'nii') ? newEntry.type = 'picture' : newEntry.type = 'file'; break;
                    case 'md' : newEntry.type = 'text'; break;
                    case 'mkv' : 
                    case 'avi' : 
                    case 'mp4' : newEntry.type = 'video'; break;
                    case 'mp3' :
                    case 'flac' :
                    case 'FLAC' :
                    case 'wav' : 
                    case 'WAV' : newEntry.type = 'audio'; break;
                    default : newEntry.type = 'file';
                }

                list.push(newEntry);
            }

            console.log('list', list);
            this.fileDisplayModal.createFileList(list);
            this.fileDisplayModal.showDialog();
        });
    }

    //expected to be called from bisweb_fileserver (see 'fileRequestFn') 
    makeRequest(params) {
        let command = params.command;
        let files = params.files;
        console.log('this', this);
        switch (params.command) {
            case 'getfile' : 
            case 'getfiles' : this.requestFile(files); break;
            default : console.log('Cannot execute unknown command', command);
        }

        /*let request = `
        ${parsedType} /${object} HTTP/1.1\n
        Host: ${this.bucketName}.s3.amazonaws.com\n
        Date: ${new Date()}
        `;
        
        console.log('request', request);
        */
    }

    requestFile(name) {


        console.log('Key', name);

        let params = {
            'Bucket' : AWSParameters.BucketName,
            'Key' : name[0]            
        };

        this.s3.getObject(params, (err, data) => {
            if (err) { console.log('an error occured', err); }
            else {
                console.log('data', data);
                let unzippedFile = wsutil.unzipFile(data.Body);
                console.log('unzipped file', unzippedFile);

                let parsedImage = new bisweb_image();
                parsedImage.initialize();
                parsedImage.parseNII(unzippedFile.buffer);
                console.log('parsedImage', parsedImage);

            }
        });
        
    }

    createUser(username, password, email, phoneNumber = null) {
        let dataEmail = {
            'Name' : 'email', 
            'Value' : email 
        };
        let dataPhoneNumber = { 
            'Name' : 'phone_number', 
            'Value' : phoneNumber 
        };

        let attributeEmail = new AWSCognitoIdentity.CognitoUserAttribute(dataEmail);
        let attributeList = [attributeEmail];

        if (phoneNumber) {
            let attributePhoneNumber = new AWSCognitoIdentity.CognitoUserAttribute(dataPhoneNumber);
            attributeList.push(attributePhoneNumber);
        }

        this.userPool.signUp(username, password, attributeList, null, (err, result) => {
            if (err) {
                console.log('Error in user pool signup', err);
                return;
            }
            this.cognitoUser = result.user;
            console.log('user returned by cognito', this.cognitoUser);
        });
    }

    confirmRegistration(code) {
        if (!this.cognitoUser) {
            console.log('No user, cannot confirm');
            return;
        }

        this.cognitoUser.confirmRegistration(code, true, (err) => {
            if (err) {
                console.log('Error confirming user registration', err);
                return;
            }

            console.log('Registration confirmed!');
        });
    }

    displayCreateUserModal() {
        if (!this.createUserModal) {
            this.createUserModal = bis_webutil.createmodal('Enter User Details', 'modal-lg');
            this.createUserModal.dialog.find('.modal-footer').find('.btn').remove();

            let confirmButton = bis_webutil.createbutton({ 'name': 'Confirm', 'type': 'btn-success' });
            let cancelButton = bis_webutil.createbutton({ 'name': 'Cancel', 'type': 'btn-danger' });

            this.createUserModal.footer.append(confirmButton);
            this.createUserModal.footer.append(cancelButton);

            let userTextPrompt = $(`<p>Enter the details to associate to your Amazon AWS profile</p>`);
            let entryBoxes = $(`
                    <div class='form-group'>
                        <label for='username'>Username:</label>
                        <input type='text' class = 'name-field form-control'>
                        <label for='email'>Email:</label>
                        <input type='text' class = 'email-field form-control'>
                        <label for='password'>Password:</label>
                        <input type='password' class = 'password-field form-control'>
                    </div>
                `);

            $(confirmButton).on('click', () => {
                let password = this.authenticateModal.body.find('.form-control')[0].value;

            });

            $(cancelButton).on('click', () => {
                this.authenticateModal.dialog.modal('hide');
            });

            //clear entry fields when modal is closed
            $(this.createUserModal.dialog).on('hidden.bs.modal', () => {
                this.authenticateModal.body.empty();
            });

            this.createUserModal.body.append(userTextPrompt);
            this.createUserModal.body.append(entryBoxes);
        }
    }

    wrapInAuth(command, parameters = null) {
        let expireTime = AWS.config.credentials.expireTime ? Date.parse(AWS.config.credentials.expireTime) : -1;
        console.log('expire time', expireTime);

        if (expireTime < Date.now()) {
            this.awsAuthUser();
            return;
        }

        switch(command) {
            case 'showfiles' : this.listObjectsInBucket(); break;
            case 'uploadfile' : this.uploadFileToBucket(parameters); break;
            default : console.log('Unrecognized aws command', command, 'cannot complete request.');
        }
        console.log('called command', command, 'with parameters', parameters);
    }

    awsAuthUser() {
        let authWindow = window.open('../web/biswebaws.html', '_blank', 'width=400, height=400');
        let idTokenEvent = (data) => {
            //console.log('storage event', data);
            if (data.key === 'aws_id_token') {
                window.removeEventListener('storage', idTokenEvent);
                //---------------------------------------------------------------
                // 2.) log into identity pool
                //---------------------------------------------------------------

                let login = {}, cognitoUserPoolKey = `cognito-idp.${AWSParameters.RegionName}.amazonaws.com/${AWSParameters.authParams.UserPoolId}`;

                //construct credentials request from id token fetched from user pool, and the id of the identity pool
                //https://docs.aws.amazon.com/cognitoidentity/latest/APIReference/API_GetId.html#API_GetId_ResponseSyntax
                login[cognitoUserPoolKey] = data.newValue;
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                    'IdentityPoolId': AWSParameters.IdentityPoolId,
                    'Logins': login,
                    'RoleSessionName': 'web'
                });

                AWS.config.credentials.get( (err) => {
                    if (err) {
                        console.log(err);
                        authWindow.postMessage({ 'failure': 'auth failed' });
                    } else {
                        console.log('Exchanged access token for access key');
                        authWindow.postMessage({ 'success': 'auth complete' }, window.location);

                        console.log('credentials', AWS.config.credentials);

                        //TODO: determine whether refresh is necessary
                        AWS.config.credentials.refresh( (err) => {
                            if (err) { console.log('an error occured refreshing', err); }
                            else { 
                                console.log('refresh successful.'); 
                                this.s3 = this.createS3(AWSParameters.BucketName, AWS.config.credentials);
                            }
                        });
                    }
                });
            }
        };

        window.addEventListener('storage', idTokenEvent);
    }
}

module.exports = AWSModule;

//Manual XML request stuff I mistakenly wrote instead of using the S3 API
//Left here in case I need it -Zach
        /*let xmlRequest = new XMLHttpRequest();
        xmlRequest.onreadystatechange = () => {
            if (xmlRequest.readyState === 4 && xmlRequest.status === 200) {
                console.log('xmlRequest', xmlRequest, 'type of response', xmlRequest.response.length);
    
                if(typeof(xmlRequest.response) === 'string') {
                    let buffer = new ArrayBuffer(xmlRequest.responseText.length);
                    let bufferView = new Uint8Array(buffer);
                    for (let i = 0; i < xmlRequest.response.length; i++) {
                        bufferView[i] = xmlRequest.response.charCodeAt(i);
                    }

                    let unzippedFile = wsutil.unzipFile(bufferView);
                    console.log('bufferView', bufferView, 'buffer', buffer, 'unzipped file', unzippedFile);

                    let parsedImage = new bisweb_image();
                    parsedImage.initialize();
                    parsedImage.parseNII(bufferView);
                    console.log('parsedImage', parsedImage);
                }
            }
        };

        xmlRequest.open('GET', `http://${AWSParameters.BucketName}.s3.amazonaws.com/${name}`, true);
        xmlRequest.setRequestHeader('Content-Type', 'application/json');
        xmlRequest.setRequestHeader('response-content-type', 'application/octet-stream');
        xmlRequest.send(null);
        */