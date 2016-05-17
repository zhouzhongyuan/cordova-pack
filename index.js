'use strict';
var cheerio = require('cheerio');
var co = require('co');
var fs = require('fs-extra');
var _ = require('underscore');
var cordova = require('cordova-lib').cordova,
    ConfigParser  = require('cordova-lib').configparser;


function pack(cfg){
    var o = new Object();
    o.build = function(){
        return co(function*(){
            cfg.winston.info("pack enviroment initializing......")
            yield o.preparePack();
            yield o.emptyDir('working');
            process.chdir('working');
            cfg.winston.info("pack enviroment initialize success")
            cfg.winston.info("create cordova begin")
            yield o.createCordova();
            cfg.winston.info("create cordova success")
            //TODO svn user
            cfg.winston.info("svn checkout app files begin")
            yield o.emptyDir(o.svnDir);
            yield o.getSvn(o.baseSvn,o.svnDir, 'zhouzy','zhouzy');
            cfg.winston.info("svn checkout app files success")
            cfg.winston.info("svn checkout project files begin")
            yield o.emptyDir(o.projectDir);
            yield o.getSvn(o.projectSvn, o.projectDir,  'zhouzy','zhouzy');
            cfg.winston.info("svn checkout project files success")
            yield o.processCode();
            yield o.changelibConfigJSPath();
            process.chdir(o.appName);
            yield o.addPlatform();
            yield o.addPlugin();
            if(o.appPlatform === 'android'){
                yield o.buildExtras(); //android
            }else if(o.appPlatform === 'ios'){
                yield o.preparePlatform();
            }
            yield o.addKey();
            yield o.buildApp();
            yield o.releaseFile();

            process.chdir('../..');
            yield o.emptyDir('working');
            return o;
        })
    };
    o.id = cfg.id;
    o.baseSvn = cfg.baseSvn;
    o.projectSvn = cfg.projectSvn;
    o.appName = cfg.appName;
    o.appEnglish = cfg.appEnglishName;
    o.appDescription = cfg.appDescription;
    o.appIcon = cfg.appIcon;
    o.appContent = cfg.appContent;
    o.appPlugin = cfg.appPlugin || cfg['appPlugin[]'];
    o.projectSvnUser = cfg.projectSvnUser;
    o.projectSvnPassword = cfg.projectSvnPassword;
    o.appPlatform = cfg.appPlatform;
    o.appNameSpace = cfg.appNameSpace;
    o.svnDir = o.appName + '/www';
    o.baseSvnUser = 'zhouzy';
    o.baseSvnPassword = 'zhouzy';
    o.configXML = o.appName + '/config.xml';
    o.projectDirName = function(){
        var projectDirName = o.projectSvn;
        if( projectDirName.split('/').slice(-1).toString().length < 1 ){
            projectDirName = projectDirName.split('/').slice(-2,-1);
        }else{
            projectDirName = projectDirName.split('/').slice(-1);
        }
        projectDirName = projectDirName.toString();
        return projectDirName;
    };
    o.projectPath = o.svnDir + '/js/lib/';
    o.projectDir = o.svnDir + '/js/lib/' + o.projectDirName();
    o.libConfigJSPath = o.svnDir + '/js/lib/config/config.js';
    o.platform = cfg.appPlatform;
    o.appBuildType = cfg.appBuildType;
    o.appPackageName = cfg.appPackageName;
    o.appVersion = cfg.appVersion;
    o.appIosMp = cfg.appIosMp;

    o.apkLink = cfg.apkDownloadLink;
    o.ipaLink = cfg.ipaLink;
    o.preparePack = function(){
        return new Promise(function(resolve,reject){
            var cwd = process.cwd().split('/');
            var currentDir = cwd[cwd.length - 1].toString();
            var parentDir = cwd[cwd.length - 2].toString();

            if(parentDir == 'working'){
                process.chdir('../..');
                resolve('Change dir to cordova\'s parent dir.');
            }
            resolve('The current dir is right.\nNo need to change.');
        });
    }
    o.getSvn = function(url,dir,username,password) {
        return new Promise(function (resolve, reject) {
            var Client = require('svn-spawn');
            var client = new Client({
                cwd: dir,
                username: username,
                password: password
            });
            client.checkout(url,function(err, data) {
                if(err){
                    reject(new Error(err))
                }
                resolve(data);
            });

        });
    };
    //Change cordova/www/js/lib/config/config.js
    o.changelibConfigJSPath = function(){
        return new Promise(function (resolve, reject) {
            var configJs = 'define(["lib/' + o.projectDirName() + '/config"],function(config) {\n' +
                '    return config;\n' +
                '});';
            fs.writeFile(o.libConfigJSPath, configJs,function(err, data) {
                if(err){
                    reject(new Error(err))
                }
                resolve(data);
            });
        });
    };
    o.createCordova = function (){
        return new Promise(function (resolve, reject) {
            cordova.create(o.appName, o.appNameSpace,o.appName,  function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                resolve(data);
            });
        });
    };
    o.processCode = function(){
        var configPath = o.configXML;
        return new Promise(function (resolve, reject) {
            var conf = new ConfigParser(configPath);
            if (o.appVersion) conf.setVersion(o.appVersion);
            if (o.appPackageName) conf.setPackageName(o.appPackageName);
            if (o.appName) conf.setName(o.appName);
            if (o.appDescription) conf.setDescription(o.appDescription);
            //TODO icon
            var icons = conf.getIcons(o.appPlatform);
            conf.addElement('icon',{'src':o.appIcon});
            //TODO access
            conf.addElement('access',{'origin':'cdvfile://*'});
            //TODO content

            //TODO preference
            conf.addElement('preference',{'name':'WebViewBounce','value':'false'});
            conf.addElement('preference',{'name':'DisallowOverscroll','value':'true'});
            conf.addElement('preference',{'name':'Orientation','value':'portrait'});
            conf.addElement('allow-navigation',{'href':'*'});
            //splash image
/*            var splashImage = '<splash src="res/ios/Default~iphone.png" width="320" height="480"/>\
                <splash src="../../res/ios/Default@2x~iphone.png" width="640" height="960"/>\
                <splash src="../../res/ios/Default-Portrait~ipad.png" width="768" height="1024"/>\
                <splash src="../../res/ios/Default-Portrait@2x~ipad.png" width="1536" height="2048"/>\
                <splash src="../../res/ios/Default-Landscape~ipad.png" width="1024" height="768"/>\
                <splash src="../../res/ios/Default-Landscape@2x~ipad.png" width="2048" height="1536"/>\
                <splash src="../../res/ios/Default-568h@2x~iphone.png" width="640" height="1136"/>\
                <splash src="../../res/ios/Default-667h.png" width="750" height="1334"/>\
                <splash src="../../res/ios/Default-736h.png" width="1242" height="2208"/>\
                <splash src="../../res/ios/Default-Landscape-736h.png" width="2208" height="1242"/>';
            conf.addElement('platform',{'name':'ios','value':splashImage});
            conf.addElement('preference',{'name':'AutoHideSplashScreen','value':'true'});*/


            conf.write();
            try {
                var $ = cheerio.load(fs.readFileSync(o.configXML), {
                    decodeEntities: false,
                    xmlMode: true
                });
                if ($) {
                    var splash =
                    '<platform name="ios">'+
                        '<splash src="../../res/ios/Default~iphone.png" width="320" height="480"/>'+
                        '<splash src="../../res/ios/Default@2x~iphone.png" width="640" height="960"/>'+
                        '<splash src="../../res/ios/Default-Portrait~ipad.png" width="768" height="1024"/>'+
                        '<splash src="../../res/ios/Default-Portrait@2x~ipad.png" width="1536" height="2048"/>'+
                        '<splash src="../../res/ios/Default-Landscape~ipad.png" width="1024" height="768"/>'+
                        '<splash src="../../res/ios/Default-Landscape@2x~ipad.png" width="2048" height="1536"/>'+
                        '<splash src="../../res/ios/Default-568h@2x~iphone.png" width="640" height="1136"/>'+
                        '<splash src="../../res/ios/Default-667h.png" width="750" height="1334"/>'+
                        '<splash src="../../res/ios/Default-736h.png" width="1242" height="2208"/>'+
                        '<splash src="../../res/ios/Default-Landscape-736h.png" width="2208" height="1242"/>'+
                    '</platform>';
                    $('widget').append(splash);
                    fs.writeFile(o.configXML,$.xml(),function(err,data){
                        if (err) {
                            reject(new Error(err))
                        }

                        resolve(data);
                    });
                }
            }catch(ex){
                reject(ex)
            }
        });
    };
    o.cleanPlatform = function (platform){
        return new Promise(function (resolve, reject) {
            var platform = platform || o.appPlatform ;
            cfg.winston.info('clean platform ',platform,' begin');
            cordova.clean(platform,{'verbose': true},function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                cfg.winston.info('clean platform ',platform,' success');
                resolve(data);
            });
        });
    };
    o.addPlatform = function (platform){
        return new Promise(function (resolve, reject) {
            var platform = platform || o.appPlatform ;
            cfg.winston.info('add platform', platform,'begin');
            cordova.platform('add', platform,{'verbose': true},function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                cfg.winston.info('add platform',platform,'success');
                resolve(data);
            });
        });
    };
    o.listPlatform = function(){
        cfg.winston.info('list platform begin, dir:',process.cwd());
        return new Promise(function (resolve, reject) {
            cordova.platform('ls', function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                cfg.winston.info('list platform','success');
                resolve(data);
            });
        });
    };
    o.removePlatform = function(platform){
        return new Promise(function (resolve, reject) {
            var platform = platform || o.appPlatform ;
            cordova.platform('remove', platform,function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                resolve(data);
            });
        });
    };
    o.preparePlatform = function(){
        return new Promise(function (resolve, reject) {
            cfg.winston.info('prepare platform begin');
            cordova.prepare({platforms: [o.platform], options: {} }, function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                resolve(data);
            });
        });
    };
    o.addPlugin = function(){
        var pluginPre = '../../plugin/node_modules/';
        return co(function *() {
            cfg.winston.info('add plugin begin');
            var plugin = o.appPlugin;
            if( typeof plugin !='undefined' && plugin.length != 0){
                plugin = plugin.split(',');
                //分类
                var pluginWithVariable = [];
                var pluginWithoutVariable = [];
                for(var i=0;i<plugin.length;i++){
                    if(plugin[i].indexOf('?') === -1){
                        pluginWithoutVariable.push(pluginPre + plugin[i].toString());
                    }else{
                        pluginWithVariable.push(pluginPre + plugin[i].toString());
                    }
                }
                console.log(pluginWithVariable);
                if(pluginWithVariable.length !== 0) {
                    for(var i=0;i<pluginWithVariable.length;i++){
                        //拆分plugin 和 variable
                        var plugin = pluginWithVariable[i].toString();
                        var pluginName = plugin.split('?')[0].toString();
                        var pluginVariable = plugin.split('?')[1];
                        //toJson
                        var variable = {};
                        variable.cli_variables = {};
                        _.each(pluginVariable.split('&'),function(v){
                            variable.cli_variables[v.split('=')[0]] = v.split('=')[1];
                        });
                        console.log((pluginName,variable));
                        yield o.addPluginReal(pluginName,variable);
                    }
                }
                //添加
                if(pluginWithoutVariable.length !== 0){
                    yield o.addPluginReal(pluginWithoutVariable);
                }
            }
        });
    };
    o.addPluginReal = function(plugin,variable){
        cfg.winston.info(plugin,variable);
        cfg.winston.info('begin to add plugin');
        return new Promise(function (resolve, reject) {
            cordova.plugin('add', plugin, variable,{'verbose': true},function (err, data) {
                if (err) {
                    console.error(err.stack)
                    reject(new Error(err))
                }
                resolve(data);
            });
        });
    };
    o.removePlugin = function(){
        return new Promise(function (resolve, reject) {
            cordova.plugin('ls',function(err,data){
                cfg.winston.info(data);
                if( data.length != 0){
                    cordova.plugin('remove', data,function (err, data) {
                        if (err) {
                            reject(new Error(err))
                        }
                        cfg.winston.info('plugin remove ','success');
                        resolve(data);
                    });
                }else {
                    resolve('no plugin');
                }

            })
        });
    };

    o.buildExtras = function(){
        return new Promise(function (resolve, reject) {
            cfg.winston.info('add build extras begin');
            var lintOptions =
                "android {\n" +
                "    lintOptions {\n" +
                "        disable 'MissingTranslation'\n" +
                "        disable 'ExtraTranslation'\n" +
                "    }\n" +
                "}";
            fs.writeFile('platforms/android/build-extras.gradle', lintOptions, function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                resolve(data);
            });
        });

    };
    o.addKey = function(){
        return new Promise(function (resolve, reject) {
            var json = {
                "android": {
                    "release": {
                        "keystore": "../../key/android.keystore",
                        "storePassword": "bokesoft",
                        "alias": "android",
                        "password" : "bokesoft",
                        "keystoreType": ""
                    },
                    "debug": {
                        "keystore": "../../key/android.keystore",
                        "storePassword": "bokesoft",
                        "alias": "android",
                        "password" : "bokesoft",
                        "keystoreType": ""
                    }
                },
                "ios": {
                    "debug": {
                        "codeSignIdentitiy": "iPhone Development",
                        "provisioningProfile": "2538e3a2-e134-4968-9d67-6f3220027cc4"

                    },
                    "release": {
                        "codeSignIdentitiy": "iPhone Distribution",
                        "provisioningProfile": "2538e3a2-e134-4968-9d67-6f3220027cc4"


                    }
                }
            };
            //修改mp
            json.ios.debug.provisioningProfile = o.appIosMp;
            json.ios.release.provisioningProfile = o.appIosMp;
            var json = JSON.stringify(json);
            fs.writeFile('build.json', json, function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                resolve(data);
            });
        });
    }
    o.buildApp = function(){
        return new Promise(function (resolve, reject) {
            cfg.winston.info('build',o.platform,'begin')
            var buildType = o.appBuildType == 'release'?true:false;
            cordova.build({platforms:[o.platform],options:{"release":buildType,"silent":false,"device":true}},function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                resolve(data);
                cfg.winston.info('build',o.platform,'success')
            });
        });
    };
    o.releaseFile = function(){
        return new Promise(function (resolve, reject) {
            var src;
            var dest;
            switch (o.platform){
                case 'android':
                    src = ['platforms/android/build/outputs/apk/android-',o.appBuildType,'.apk'].join('');
                    dest = o.apkLink;
                    break;
                case 'ios':
                    src = ['platforms/ios/build/device/',o.appName,'.ipa'].join('');
                    dest = o.ipaLink;
                    break;
                default:
                    reject('The platform is not support.') ;
            };
            fs.copy(src, dest,function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                resolve(data);
            });
        });
    };
    o.emptyDir = function(dir){
        cfg.winston.info('empty',dir,'begin');
        return new Promise(function (resolve, reject) {
            fs.emptydir(dir,function (err, data) {
                if (err) {
                    reject(new Error(err))
                }
                cfg.winston.info('empty',dir,'success');
                resolve(data);
            });
        });
    };
    return o;
};
module.exports = pack;