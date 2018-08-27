const IDENTITY_POOL_ID = 'eu-central-1:52b31691-b94e-4f68-95d2-7f45e3d173bc';

function reportError(e) {
    $('#note').find('.message').text('Operation failed. ' + e);
    $('#note').removeClass('everything-ok');
}


async function callLambda(request) {
    const requestWithFormat = Object.assign({format: 'INVOKE'}, request);
    const lambda = new AWS.Lambda();
    var params = {
        FunctionName: "dataplatform-tagging-dev-main", 
        InvocationType: "RequestResponse", 
        Payload: JSON.stringify(requestWithFormat)
    };

    const lambdaWrappedResponse = await lambda.invoke(params).promise();

    if (lambdaWrappedResponse.FunctionError) {
        const errorMessage = JSON.parse(lambdaWrappedResponse.Payload).errorMessage;
        throw new Error(errorMessage);
    } 

    
    const ret = JSON.parse(lambdaWrappedResponse.Payload).body;
    return ret;
}

async function findArena() {
    const findArenaResponse = await callLambda({
        what: 'FIND_ARENA'
    });
    console.log('find arena response ', JSON.stringify(findArenaResponse));
    return findArenaResponse;
}

async function fetchSanpshot(pageUrl, snapshotTimestamp) {    
    const lambdaResponse = await callLambda({
        what: 'VIEW_SNAPSHOT',
        pageUrl,
        snapshotTimestamp
    });
    console.log('Got backend response=\n' + JSON.stringify(lambdaResponse, null, 2));
    
    const s3 = new AWS.S3();
    const s3PngResp = await s3.getObject({Bucket: lambdaResponse.bucket, Key: lambdaResponse.keyImage}).promise();
    const b64 = s3PngResp.Body.toString('base64');
    const imageUrl = `data:image/png;base64,${b64}`;

    const s3DomResp = await s3.getObject({Bucket: lambdaResponse.bucket, Key: lambdaResponse.keyDom}).promise();
    const savedDom = JSON.parse(new TextDecoder("utf8").decode(s3DomResp.Body));

    const ret = new Snapshot(savedDom, imageUrl);
    return ret;
}

function onSignIn(googleUser) {
    // Useful data for your client-side scripts:
    var profile = googleUser.getBasicProfile();

    // The ID token you need to pass to your backend:
    var id_token = googleUser.getAuthResponse().id_token;

    // Based on: https://docs.aws.amazon.com/cognito/latest/developerguide/google.html

    // Add the Google access token to the Cognito credentials login map.
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: IDENTITY_POOL_ID,
        Logins: {
            'accounts.google.com': id_token
        }
    });

    AWS.config.region = 'eu-central-1';
    
    // Obtain AWS credentials
    AWS.config.credentials.get(async () => {
        // Access AWS resources here.
        $('#greet').text(`Welcome, ${profile.getEmail()}.`);
        const arena = await findArena();
        const pb = fetchSanpshot(arena.pageUrl, arena.revisionFirst);
        const pa = fetchSanpshot(arena.pageUrl, arena.revisionSecond);

        try {
            const snapshots = await Promise.all([pa, pb]);
            startEditor(snapshots);
        } catch (e) {
            console.error('e=', e);
            reportError(e);
        }
    });
}

function startEditor(snapshots) {
    drawTagger($('#snapshot_container_1'), snapshots[0].savedDom, snapshots[0].imageUrl); 
    drawTagger($('#snapshot_container_2'), snapshots[1].savedDom, snapshots[1].imageUrl); 
}

$(document).ready(async () => {
    const note = $('#note');
    const widget = note.find('.dismiss-widget');
    widget.click(() => {
        note.addClass('everything-ok');
    });
    widget.hover(() => widget.addClass('hover'), () => widget.removeClass('hover'));

    if (location.host === "imaman.github.io") {
        return;
    }

    try {
        const savedDom = await $.get('local_only/dom.json');
        const imageUrl = 'local_only/download.png';
        const snapshot = new Snapshot(savedDom, imageUrl);
        startEditor([snapshot, snapshot]);
    } catch(e) {
        console.error('e=', e);
        reportError(e);
    }
});
