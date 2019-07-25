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

 'use strict';

 const baseutils = require("baseutils");
 const BaseModule = require('basemodule.js');
 const smreslice = require('bis_imagesmoothreslice');

 /**
  * flips an image along any combination of the three axes
  */
 class BilateralFilterModule extends BaseModule {
     constructor() {
         super();
         this.name = 'bilateralFilter';
     }
 
     createDescription() {
         return {
             "name": "BilateralFilter",
             "description": "This algorithm performes a Bilateral Filter",
             "author": "Kol Crooks",
             "version": "1.0",
             "inputs": baseutils.getImageToImageInputs('Load the image to be Filtered'),
             "outputs": baseutils.getImageToImageOutputs(),
             "buttonName": "Bilateral Filter",
             "shortname" : "bltrF",
             "params": [
                {
                    "name": "Radius",
                    "description": "radius",
                    "priority": 1,
                    "advanced": false,
                    "gui": "slider",
                    "varname": "radius",
                    "type": 'int',
                    "default": 2,
                    "low": 0.0,
                    "high": 10.0,
                },
                 {
                     "name": "Spatial",
                     "description": "Spatial mod var",
                     "priority": 2,
                     "advanced": false,
                     "gui": "slider",
                     "varname": "svar",
                     "type": 'float',
                     "default": 2.0,
                     "low": 0.5,
                     "high": 10.00,
                 },
                 {
                    "name": "Radiometric",
                    "description": "radiometric mod var",
                    "priority": 3,
                    "advanced": false,
                    "gui": "slider",
                    "varname": "rvar",
                    "type": 'float',
                    "default": 2.0,
                    "low": 0.5,
                    "high": 10.00,
                },
                {
                    "name": "Iterations",
                    "description": "number of iterations that the filter runs",
                    "priority": 4,
                    "advanced": false,
                    "gui": "slider",
                    "varname": "numiter",
                    "type": 'int',
                    "default": 2,
                    "low": 0.0,
                    "high": 10.0,
                },
                 baseutils.getDebugParam(),
             ],
 
         };
     }
 
     directInvokeAlgorithm(vals) {
         console.log('oooo invoking: bilateralfilter with vals', JSON.stringify(vals));
         let input = this.inputs['input'];
         this.outputs['output'] = smreslice.BilateralFilter(input, vals.radius, vals.rvar, vals.svar, vals.numiter);
        console.log('--FINISHED FILTER--');
        return Promise.resolve();
    }
 
 
 
 }
 
 module.exports = BilateralFilterModule;
 