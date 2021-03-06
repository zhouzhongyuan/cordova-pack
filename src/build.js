import {cordova} from 'cordova-lib';

function build(platform, release){
    return new Promise( (resolve, reject) => {
        console.log(platform, release);
        cordova.build( {platforms: [platform], options:{"release":release,"silent":false,"device":true}}, (err, data) => {
            if (err) {
                reject( {success: false, data: err} )
            }
            resolve({success: true, data: data});
        });
    });
}

export default build;
