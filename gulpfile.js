

/*  LICENSE
    
    _This file is Copyright 2018 by the Image Processing and Analysis Group (BioImage Suite Team). Dept. of Radiology & Biomedical Imaging, Yale School of Medicine._
    
    BioImage Suite Web is licensed under the Apache License, Version 2.0 (the "License");
    
    - you may not use this software except in compliance with the License.
    - You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)
    
    __Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.__
    
    ENDLICENSE */

/* jshint node:true */

"use strict";

require('./config/bis_checknodeversion');

const gulp = require('gulp'),
      program=require('commander'),
      os = require('os'),
      fs = require('fs'),
      path=require('path'),
      colors=require('colors/safe'),
      bis_gutil=require('./config/bis_gulputils');

// ------------------------------------ Utility Functions ---------------------------------------------


// -----------------------------------------------------------------------------------------
// Command Line stuff 
// -----------------------------------------------------------------------------------------

program
    .option('-i, --input <s>','mainscript to build')
    .option('-m, --minify <s>','flag to minify 1=minify 0=regular + sourcemaps,-1 = fast, no sourcemaps')
    .option('-l, --platform  <s>','platform')
    .option('-d, --debug <s>','debug')
    .option('-p, --dopack <s>','dopackage 0=electron-packager, 1=run npm update in addition 2=run inno or zip in addition')
    .option('-z, --dozip <s>','dozip')
    .option('--localhost','only local access')
    .option('--portno <s>','port for server (8080 is default)')
    .option('-n, --internal <n>','if 1 use internal code, if 2 serve the internal directory as well',parseInt)
    .option('-x, --external <n>','if 1 use extra external code (in ../external)',parseInt)
    .option('-e, --eslint <n>','if 0 use jshint instead of eslint',parseInt)
    .option('-w, --worker <n>','if 1 build the webworker as well',parseInt)
    .option('-s, --sworker <n>','if 1 build the service worker and index.js as well',parseInt)
    .option('--light <n>','if 1 only build the main bislib.js library',parseInt)
    .parse(process.argv);


if (program.dopack === undefined)
    program.dopack=2;

let options = {
    inpfilename : program.input || "all",
    minify : parseInt(program.minify || 0 ),
    outdir : "build/web",
    distdir : "build/dist",
    debug : parseInt(program.debug || 0),
    platform : program.platform || os.platform(),
    package : program.dopack || 0,
    zip : program.dozip || 0,
    webworker : program.worker || 0,
    eslint : program.eslint,
    sworker : program.sworker || 0,
    internal : program.internal,
    external : program.external || 0 ,
    portno : parseInt(program.portno) || 8080,
    hostname : '0.0.0.0'
};

if (program.localhost)
    options.hostname='localhost';

if (program.internal === undefined)
    options.internal=1;

if (program.eslint === undefined)
    options.eslint=1;


const mainoption=program.rawArgs[2];

// -----------------------------------------------------------------------------------------
// Install and Zip Issues
// Second pass to help with gulp zip and gulp package
// -----------------------------------------------------------------------------------------
if (mainoption=="zip")
    options.zip=1;
if (mainoption=="fullpackage")
    options.package=2;


options.baseoutput=".";
options.outdir+="/";

let plat=options.platform;
if (plat==='all') {
    plat=[ 'win32','linux'];
    if (os.platform()!=='win32')
        plat.push("darwin");
} else {
    plat=options.platform.split(",");
}
options.platform=plat;


if (options.debug!==0) {
    console.log(bis_gutil.getTime()+' Full options ='+JSON.stringify(options)+'.\n');
}

// -----------------------------------------------------------------------------------------
// M A I N  P R O G R A M Set internal structure with all parameters
// -----------------------------------------------------------------------------------------

let internal = {
    dependcss : [ 
        "./lib/css/bootstrap_dark_edited.css", 
        "./lib/css/bootstrap-colorselector.css",
        "./node_modules/jstree/dist/themes/default/style.css",
        "./web/biscommon.css"
    ],
    lintscripts : ['js/**/*.js','config/*.js','compiletools/*.js','*.js','web/**/*.js','test/**/*.js','fileserver/*.js'],
    toolarray : [ 'index'],
    htmlcounter : 0,
    csscounter  : 0,
    jscounter   : 0,
    bislib     : 'bislib.js',
    biscss     : 'bislib.css',
    indexlib   : 'index.js',
    serviceworkerlib : 'bisweb-sw.js',
    webworkerlib  : 'wegit bworkermain.js',
    serveroptions : { },
    setwebpackwatch : 0,
    
};


// Define server options
internal.serveroptions = {
    "root" : path.normalize(__dirname),
    "host" : options.hostname,
    "port" : `${options.portno}`,
    'directoryListing': true,
    'open' : true,

};

if (options.external>0) {
    options.external=1;
}

if (options.internal>=2 || options.external>0)  {
    internal.serveroptions = {
        "root" : path.normalize(path.resolve(__dirname,'..'))
    };
}


if (options.internal) {
    internal.lintscripts.push('../internal/js/*/*.js');
    internal.lintscripts.push('../internal/js/*.js');
}

if (options.external) {
    internal.lintscripts.push('../external/js/*/*.js');
    internal.lintscripts.push('../external/js/*.js');
}


// ---------------------------
// Get Tool List
// ---------------------------

internal.setup=require('./web/images/tools.json');
let keys=Object.keys(internal.setup.tools);
console.log(bis_gutil.getTime()+colors.cyan(' Config versiontag='+bis_gutil.getVersionTag(internal.setup.version)+' tools='+keys));

if (options.inpfilename === "" || options.inpfilename === "all") {
    let obj=internal.setup.tools;
    let keys=Object.keys(obj);
    options.inpfilename ='index,'+keys.join(",");
} 

// ------------------------
// Define webpack jobs
// ------------------------

if (mainoption==="build") {
    options.sworker=1;
    options.webworker=1;
}


internal.webpackjobs = [ { path: './js/webcomponents/' , name: internal.bislib } ];
if (options.inpfilename === 'index') {
    internal.webpackjobs=[];
}

if (options.sworker) {
    internal.webpackjobs.push({ path: './web/' ,  name : internal.indexlib });
    internal.webpackjobs.push({ path: './web/' ,  name : internal.serviceworkerlib });

}

if (options.webworker) {
    internal.webpackjobs.push(
        { path : "./js/webworker/",
          name : internal.webworkerlib,
        });
}

// -------------------------------
// Debug Info
// -------------------------------

if (options.debug!==0) {
    console.log(bis_gutil().getTime()+' read tool descriptions from '+colors.cyan(internal.tooldescriptionfile));
    console.log(bis_gutil().getTime()+' Scripts to process are '+colors.cyan(options.inpfilename));
}

// ------------------------------- ------------------------------- -------------------------------
//
// Preliminaries Over
//
// Define Tasks
//
// ------------------------------- ------------------------------- -------------------------------

async function createDate() {

    const git = require('git-rev');
    git.long(function (str) {
        bis_gutil.createDateFile(path.resolve(options.outdir,'bisdate.json'),str,internal.setup.version);
        bis_gutil.createDateFile(path.resolve(options.outdir,'../wasm/bisdate.js'),str,internal.setup.version);
        return Promise.resolve();
    });
}


// ------------------ JSHint ------------------

gulp.task('jshint',  (done) => {

    const jshint = require('gulp-jshint');
    for (let i=0;i<internal.lintscripts.length;i++) {
        
        gulp.src(internal.lintscripts[i])
            .pipe(jshint({ sub:true, 
                              node:true,
                              unused:true,
                              undef:true,
                              globalstrict:true,
                              esversion:6,
                              "globals": {
                                  "console": true,
                                  "require": true,
                                  "module" : true,
                              },
                            }))
            .pipe(jshint.reporter('default'));
    }
    done();
});



gulp.task('eslint',  () => { 
    // ESLint ignores files with "node_modules" paths.
    // So, it's best to have gulp ignore the directory as well.
    // Also, Be sure to return the stream from the task;
    // Otherwise, the task may end before the stream has finished.

    
    const eslint = require('gulp-eslint');
    console.log(colors.yellow(bis_gutil.getTime(),"Scannng scripts ",internal.lintscripts.join(',')));
    return gulp.src(internal.lintscripts)
    // eslint() attaches the lint output to the "eslint" property
    // of the file object so it can be used by other modules.
        .pipe(eslint({
            "env": {
                "browser": true,
                "node": true,
                "commonjs": true,
                "es6": true
            },
            "extends": "eslint:recommended",
            "parserOptions": {
                "sourceType": "module",
                "ecmaVersion": 2017
            },
            "rules": {
                'no-console': 'off',
                'indent' : 'off',
                "semi": [
                    "error",
                    "always"
                ]
            }
        })).pipe(eslint.format());
});


gulp.task('watch', () => { 
    if (options.eslint)
        return gulp.watch(internal.lintscripts, gulp.series('eslint'));
    return gulp.watch(internal.lintscripts, gulp.series('jshint'));
});


// ------------------------------------------------------------------------
gulp.task('webpack', async (done) => {
    
    await createDate();
    await bis_gutil.runWebpack(internal.webpackjobs,
                               options.internal,
                               options.external,
                               __dirname,
                               options.minify,
                               options.outdir,
                               internal.setwebpackwatch);
    console.log(bis_gutil.getTime()+' webpack done num jobs=',internal.webpackjobs.length);
    return Promise.resolve('done');
});


gulp.task('buildtest', ((done) => {
    
    let testoutdir=path.resolve(path.join(options.outdir,'test'));
    console.log('Test output dir=',testoutdir);
    gulp.src(['./test/testdata/**/*']).pipe(gulp.dest(testoutdir+'/testdata'));
    gulp.src('./test/module_tests.json').pipe(gulp.dest(testoutdir));
    bis_gutil.createHTML('biswebtest',options.outdir,'bislib.js',internal.biscss);
    let maincss    = './web/biswebtest.css';
    bis_gutil.createCSSCommon([maincss],'biswebtest.css',options.outdir);

    bis_gutil.createHTML('biswebdisplaytest',options.outdir,'bislib.js',internal.biscss);
    bis_gutil.createHTML('biswebdisplaytest2',options.outdir,'bislib.js',internal.biscss);
    let maincss2    = './web/biswebdisplaytest.css';
    bis_gutil.createCSSCommon([maincss2],'biswebdisplaytest.css',options.outdir);
    done();

}));

gulp.task('setwebpackwatch', (done) => {
    
    internal.setwebpackwatch=1;
    done();
});
    


gulp.task('webserver', ()=> {
    const webserver = require('gulp-webserver');
    console.log(colors.red(bis_gutil.getTime()+' server options=',JSON.stringify(internal.serveroptions)));
    return gulp.src('.').pipe(webserver(internal.serveroptions));
});


gulp.task('commonfiles', () => { 
    
    console.log(bis_gutil.getTime()+' Copying css,fonts,images etc. .');
    gulp.src([ 'node_modules/bootstrap/dist/css/*']).pipe(gulp.dest(options.outdir+'css/'));
    gulp.src([ 'node_modules/bootstrap/dist/fonts/*']).pipe(gulp.dest(options.outdir+'fonts/'));
    gulp.src([ 'web/images/**/*']).pipe(gulp.dest(options.outdir+'/images/'));
    gulp.src([ 'lib/fonts/*']).pipe(gulp.dest(options.outdir+'/fonts/'));
    gulp.src([ 'web/manifest.json']).pipe(gulp.dest(options.outdir));
    gulp.src('./web/bispreload.js').pipe(gulp.dest(options.outdir));
    gulp.src('./web/biselectron.js').pipe(gulp.dest(options.outdir));
    gulp.src('./web/package.json').pipe(gulp.dest(options.outdir));
    gulp.src('./lib/css/bootstrap_dark_edited.css').pipe(gulp.dest(options.outdir));
    gulp.src('./lib/js/webcomponents-lite.js').pipe(gulp.dest(options.outdir));
    gulp.src('./node_modules/jquery/dist/jquery.min.js').pipe(gulp.dest(options.outdir));
    gulp.src('./web/aws/biswebaws.html').pipe(gulp.dest(options.outdir));
    gulp.src('./node_modules/aws-sdk/dist/aws-sdk.min.js').pipe(gulp.dest(options.outdir));
    gulp.src('./node_modules/amazon-cognito-auth-js/dist/amazon-cognito-auth.min.js').pipe(gulp.dest(options.outdir));
    gulp.src('./web/aws/awsparameters.js').pipe(gulp.dest(options.outdir));
    gulp.src('./node_modules/bootstrap/dist/js/bootstrap.min.js').pipe(gulp.dest(options.outdir));
    bis_gutil.createHTML('console',options.outdir,'',internal.biscss);
    return gulp.src([ 'web/manifest.json']).pipe(gulp.dest(options.outdir));
});

gulp.task('createserverscript', (done) => { 
    
    let inp=path.normalize(path.join(__dirname,path.join('js',path.join('bin','bisfileserver.js'))));
    console.log(inp);
    let cfg=path.normalize(path.join(__dirname,path.join('config','app.config.js')));
    console.log(cfg);
    let out=path.normalize(path.join(__dirname,
                                     path.join(options.outdir,
                                               path.join('..',
                                                         path.join('wasm','lib')))));
    console.log(out);
    let cmd=` webpack-cli --entry ${inp} --config ${cfg} --output-path ${out} --output-filename bisfileserver.js`;
    console.log('Command=',cmd);
    bis_gutil.executeCommandPromise(cmd,__dirname).then( () => {
        let url=path.join(out,'bisfileserver.js');
        let stats = fs.statSync(url);
        let bytes = stats["size"];
        console.log('____ saved in '+url+' (size='+bytes+')');
        done();
    });
});

gulp.task('createtfjsreconscript', (done) => { 

    let inp=path.normalize(path.join(__dirname,path.join('js',path.join('bin','bis_tf_recon.js'))));
    console.log(inp);
    let cfg=path.normalize(path.join(__dirname,path.join('config','app.config.js')));
    console.log(cfg);
    let out=path.normalize(path.join(__dirname,
                                     path.join(options.outdir,
                                               path.join('..',
                                                         path.join('wasm','lib')))));
    console.log(out);
    let cmd=` webpack-cli --entry ${inp} --config ${cfg} --output-path ${out} --output-filename bis_tf_recon.js`;
    console.log('Command=',cmd);
    bis_gutil.executeCommandPromise(cmd,__dirname).then( () => {
        let url=path.join(out,'bisfileserver.js');
        let stats = fs.statSync(url);
        let bytes = stats["size"];
        console.log('____ saved in '+url+' (size='+bytes+')');
        done();
    });
});

gulp.task('packageserverscript', (done)=> { 

    const gulpzip = require('gulp-zip'),
          rename = require('gulp-rename');
          
    gulp.src(['./build/wasm/lib/bisfileserver.js',
              './build/wasm/lib/bis_tf_recon.js',
              './js/bin/server/example-server-config.json',
              './js/bin/server/package.json',
              './js/bin/server/README.md'
             ]).
        pipe(rename({dirname: 'biswebserver'})).
        pipe(gulpzip(path.join(options.outdir,'server.zip'))).
        pipe(gulp.dest('.')).on('end', () => {
            let url=path.resolve(path.join(options.outdir,'server.zip'));
            let stats = fs.statSync(url);
            let bytes = stats["size"];
            let kbytes=Math.round(bytes/(1024)*10)*0.1;
            console.log('____ zip file created in '+url+' (size='+kbytes+' KB)');
            done();
        });
});

gulp.task('tools', ( (cb) => {
    
    internal.toolarray = options.inpfilename.split(",");
    console.log(bis_gutil.getTime()+colors.green(' Building tools ['+internal.toolarray+']'));
    
    for (let index=0;index<internal.toolarray.length;index++) {
        let toolname=internal.toolarray[index];
        console.log(bis_gutil.getTime()+colors.green(' Building tool '+(index+1)+'/'+internal.toolarray.length+' : '+internal.toolarray[index]));
        internal.jscounter+=1;
        console.log('Counter=',internal.jscounter);


        let jsname =internal.bislib;
        if (index===0)
            jsname=internal.indexlib;
        bis_gutil.createHTML(toolname,options.outdir,jsname,internal.biscss);
        bis_gutil.createCSSCommon(internal.dependcss,internal.toolarray[index]+'.css',options.outdir);
    }
    cb();
}));

gulp.task('zip', ((done) => {
    
    bis_gutil.createZIPFile(options.zip,options.baseoutput,options.outdir,internal.setup.version,options.distdir);
    done();
}));

gulp.task('package', (done) => {
    
    bis_gutil.createPackage(options.package,
                            internal.setup.tools,
                            __dirname,options.outdir,internal.setup.version,options.platform,options.distdir,done);
});

gulp.task('clean', () => { 

    const del = require('del');
    let arr = [options.outdir+'#*',
               options.outdir+'*~',
               options.outdir+'*.js*',
               options.outdir+'*.zip',
               options.outdir+'*.wasm',
               options.outdir+'*.png',
               options.outdir+'*.html*',
               options.outdir+'*.css*',
               options.outdir+'css/*',
               options.outdir+'fonts/*',
               options.outdir+'images/*',
               options.outdir+'doc/*',
               options.outdir+'node_modules',
               options.outdir+'test',
               options.distdir+"/*",
              ];
    
    console.log(bis_gutil.getTime()+' Cleaning files ***** .');
    return del(arr);
});

gulp.task('jsdoc', (done) => { 
    bis_gutil.jsDOC(__dirname,'config/jsdoc_conf.json',done);
});

gulp.task('cdoc', (done) =>  { 
    bis_gutil.doxygen(__dirname,'config/Doxyfile',done);
});

gulp.task('npmpack', (done) => { 
    bis_gutil.createnpmpackage(__dirname,internal.setup.version,'build/dist',done);
});


// -------------------- Straight compound tasks
gulp.task('buildint', gulp.series('commonfiles','tools','buildtest'));

gulp.task('build',gulp.parallel(
    'webpack',
    gulp.series('commonfiles','tools'),
    gulp.series(gulp.parallel('buildtest',
                              'createserverscript',
                              'createtfjsreconscript'),
                'packageserverscript')));



gulp.task('buildpackage', gulp.series('buildint',
                                      'package'));



gulp.task('doc', gulp.parallel('jsdoc','cdoc'));


gulp.task('serve',
          gulp.series(
              'setwebpackwatch',
              'webserver',
              gulp.parallel(
                  'watch',
                  'webpack')
          ));

gulp.task('default', gulp.series('serve'));


