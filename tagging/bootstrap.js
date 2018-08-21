function reportError(e) {
    $('#note').find('.message').text('Operation failed ' + e + '[click to close]');
    $('#note').removeClass('everything-ok');
}

function onSignIn(googleUser) {
    // Useful data for your client-side scripts:
    var profile = googleUser.getBasicProfile();

    // The ID token you need to pass to your backend:
    var id_token = googleUser.getAuthResponse().id_token;

    // Based on: https://docs.aws.amazon.com/cognito/latest/developerguide/google.html

    // Add the Google access token to the Cognito credentials login map.
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'eu-central-1:52843c56-0d9a-4b4b-b703-eace049717bf',
        Logins: {
            'accounts.google.com': id_token
        }
    });

    AWS.config.region = 'eu-central-1';
    
    // Obtain AWS credentials
    AWS.config.credentials.get(function() {
        // Access AWS resources here.
        const s3 = new AWS.S3();
        const lambda = new AWS.Lambda();
        const request = {
            format: 'INVOKE',
            what: 'VIEW_SNAPSHOT',
            pageUrl: 'https://aws.amazon.com/ec2',
            snapshotTimestamp: '2018-08-16T19:15:31.704Z'
        };

        var params = {
            FunctionName: "testim-snapshotting-backend-dev-testim-runner", 
            InvocationType: "RequestResponse", 
            Payload: JSON.stringify(request)
        };
        lambda.invoke(params, (err, data) => {
            if (err) {
                return reportError(err);
            }

            if (data.FunctionError) {
                const errorMessage = JSON.parse(data.Payload).errorMessage
                return reportError(errorMessage);
            } 

            $('#greet').text(`Welcome, ${profile.getEmail()}.`);

            const resp = JSON.parse(data.Payload).body;
            console.log('Got backend response=\n' + JSON.stringify(resp, null, 2));
            const imageUrl = `https://${resp.bucket}.s3.amazonaws.com/${resp.keyImage}`;

            s3.getObject({Bucket: resp.bucket, Key: resp.keyDom}, (err, data) => {
                if (err) {
                    return reportError(err);
                }
                const recordedDom = JSON.parse(new TextDecoder("utf8").decode(data.Body));
                startEditor(recordedDom, imageUrl);
            });
        });
    });
}

function startEditor(savedSanpshot, imageUrl) {
    drawTagger($('#snapshot_container_1'), savedSanpshot, imageUrl); 
    drawTagger($('#snapshot_container_2'), savedSanpshot, imageUrl); 
}

$(document).ready(async () => {
    const note = $('#note');
    note.find('button').click(() => {
        note.addClass('everything-ok');
    });

    if (location.host === "imaman.github.io") {
        return;
    }

    const savedSanpshot = await $.get('local_only/dom.json');
    const imageUrl = 'local_only/download.png';
    startEditor(savedSanpshot, imageUrl);
});
