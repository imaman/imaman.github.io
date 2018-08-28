const IDENTITY_POOL_ID = 'eu-central-1:52b31691-b94e-4f68-95d2-7f45e3d173bc';


function reportNone() {
    $('#note').addClass('everything-ok').removeClass('notification').removeClass('error');
}

function reportError(e) {
    $('#note').find('.message').text('Operation failed. ' + e);
    $('#note').removeClass('everything-ok').addClass('error');
}

function reportMessage(text) {
    $('#note').find('.message').text(text);
    $('#note').removeClass('everything-ok').addClass('notification');
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

    const ret = new Snapshot(savedDom, imageUrl, lambdaResponse);
    return ret;
}

async function findArena() {
    const queryParams = (new URL(document.location)).searchParams;
    const arenaId = queryParams.get('id');
    if (arenaId) {
        const ret = await callLambda({
            what: 'LOOKUP_ARENA_BY_ID',
            id: arenaId
        });

        if (!ret.id === arenaId) {
            location.href = '?';
            return;
        }

        return ret;
    }

    const findArenaResponse = await callLambda({
        what: 'FIND_ARENA'
    });
    console.log('Redirecting based on find arena response=\n', JSON.stringify(findArenaResponse));
    if (!findArenaResponse) {
        throw new Error('Problem finding what to tag');
    }

    if (!findArenaResponse.id) {
        // Nothing to tag.
        return {};        
    }

    location.replace(`?id=${findArenaResponse.id}`)
}


function onSignIn(googleUser) {

    class LambdaClient {
        async reject(snapshot) {
            const request = { 
                what: 'REJECT_REVISION',
                pageUrl: snapshot.metadata.pageUrl,
                snapshotTimestamp: snapshot.metadata.snapshotTimestamp
            };
            return callLambda(request);
        }

        async recapture(snapshot) {
            const request = { 
                what: 'RECAPTURE_SNAPSHOT',
                pageUrl: snapshot.metadata.pageUrl,
                snapshotTimestamp: snapshot.metadata.snapshotTimestamp,
                keyImage: snapshot.metadata.keyImage,
                keyDom: snapshot.metadata.keyDom,
            };
            return callLambda(request);
        }
    }
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
        const elem = $('#page_header>.page-metadata');
        if (!arena.id) {
            elem.text('All snapshots were tagged! Your work here is done.');
            return;
        }

        elem.html(`PAGE: <a href="//${arena.pageUrl}">${arena.pageUrl}</a>`)
        const pa = fetchSanpshot(arena.pageUrl, arena.revisionFirst);
        const pb = fetchSanpshot(arena.pageUrl, arena.revisionSecond);

        try {
            const snapshots = await Promise.all([pa, pb]);
            startEditor(snapshots, new LambdaClient());
        } catch (e) {
            console.error('e=', e);
            reportError(e);
        }
    });
}

function startEditor(snapshots, lambdaClient) {
    const services = {
        lambdaClient,
        reportMessage: reportMessage,
        reportError: reportError,
        reportNone: reportNone
    }
    $('#page_header>.next').click(() => {
        location.href = '?';
    });

    drawTagger($('#snapshot_container_1'), snapshots[0], services); 
    drawTagger($('#snapshot_container_2'), snapshots[1], services); 
}

$(document).ready(async () => {
    const widget = $('#note').find('.dismiss-widget');
    widget.click(() => {
        reportNone();
    });
    widget.hover(() => widget.addClass('hover'), () => widget.removeClass('hover'));

    if (location.host === "imaman.github.io") {
        return;
    }

    try {
        const savedDom = await $.get('local_only/dom.json');
        const imageUrl = 'local_only/download.png';
        const snapshot = new Snapshot(savedDom, imageUrl, {a: 1, b: 2, c: 3});
        startEditor([snapshot, snapshot]);
    } catch(e) {
        console.error('e=', e);
        reportError(e);
    }
});
