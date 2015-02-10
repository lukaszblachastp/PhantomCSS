'use strict';
/* global casper */
var pediff = require('./pediff.js');
var config = require('./config.js');
var fs = require('fs');

var tasksPath = './tasks/';
var tasks = [casper.cli.options.task];

if(!tasks[0]) {
    tasks = fs.list(tasksPath)
        .filter(function(taskFile) {
            return taskFile.length>3 && taskFile.substr(taskFile.length-3)==='.js';
        })
        .map(function(taskFile) {
            return require(tasksPath + taskFile);
        });
} else {
    if(!fs.isFile(tasksPath + tasks[0] + '.js')) {
        throw 'Unable to find task: ' + tasks[0];
    }
    tasks[0] = require(tasksPath + tasks[0] + '.js');
}

pediff.init(config.pediff);
casper.start();

casper.on('page.error', function(err) {
    casper.echo(err, 'ERROR');
});

casper.on('remote.message', function(msg) {
    casper.echo(msg);
});
/*

pediff.clearAllScreenshots();

tasks.forEach(function testTask(task) {
    var taskConfig = task.config || {};
    casper.test.begin(taskConfig.package || 'default', 0, function suite(test) {

        Object.keys(config.environments).forEach(function(envName) {
            var baseUrl = config.environments[envName];

            casper.then(function testEnvironment() {
                pediff.setEnvironment(envName);
                pediff.setPackage(taskConfig.package || 'default');
            });

            config.viewports.forEach(function testViewport(viewport) {
                casper.thenOpen(baseUrl + taskConfig.path);
                casper.then(function viewportTestInner() {
                    pediff.setViewport(viewport.width, viewport.height);
                    pediff.turnOffAnimations();
                    if(config.cssmedia && config.cssmedia!=='screen') {
                        pediff.setRenderMedia(config.cssmedia);
                    }
                    pediff.injectCss(config.css, config.cssmedia);
                    task.execute.call(casper, pediff, taskConfig);
                });
            });
        });

        casper.run(function() {
            test.done();
        });
    });
});

casper.test.begin('comparing environments', 0, function suite(test){
    casper.then(function compareEnvironments() {
        var envs = Object.keys(config.environments),
            baseEnv = envs.shift();

        envs.forEach(function(env) {
            pediff.compareEnvironments(baseEnv, env);
        });
    });
    casper.run(function() {
        test.done();
    });
});
*/

casper.test.begin('Converting screenshots to .jpg', 0, function convertScreenshots(test) {
    var envNames = Object.keys(config.environments).slice(0,2);

    envNames.forEach(function(env) {
        var dirname = config.pediff.screenshotRoot + env + '/';
        var images = fs.list(dirname);

        fs.makeDirectory(dirname + 'hq/');
        images.forEach(function(filename) {
            var fullPath = dirname + filename;
            if(fs.isFile(dirname + filename) && fullPath.indexOf('.png')===fullPath.length-4) {
                pediff.convertImageToJpg(dirname, filename);
                casper.then(function() {
                    fs.move(dirname+filename, dirname + 'hq/' + filename);
                });
            }
        });
    });

    casper.run(function() {
        test.done();
    });
});
