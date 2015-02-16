'use strict';
/* global casper */
var pediff = require('./pediff.js');
var config = require('./config.js');
var fs = require('fs');

var tasksPath = './tasks/';
var taskName = casper.cli.options.task;

if(!fs.isFile(tasksPath + taskName + '.js')) {
    throw 'Unable to find task: ' + taskName;
}

var task = require(tasksPath + taskName);

pediff.init(config.pediff);
casper.start();

casper.on('page.error', function(err) {
    casper.echo(err, 'ERROR');
});

// casper.on('remote.message', function(msg) { casper.echo(msg); });

// pediff.clearAllScreenshots();

task.config = task.config || {};
task.config.package = task.config.package || 'default';
casper.test.begin('[' + task.config.package + '] Capturing screenshots', 0, function suite(test) {

    Object.keys(config.environments).forEach(function(envName) {
        var baseUrl = config.environments[envName];

        casper.then(function testEnvironment() {
            pediff.setEnvironment(envName);
            pediff.setPackage(task.config.package);
        });

        config.viewports.forEach(function testViewport(viewport) {
            casper.thenOpen(baseUrl + task.config.path);
            casper.then(function viewportTestInner() {
                pediff.setViewport(viewport.width, viewport.height);
                pediff.turnOffAnimations();
                if(config.cssmedia && config.cssmedia!=='screen') {
                    pediff.setRenderMedia(config.cssmedia);
                }
                pediff.injectCss(config.css, config.cssmedia);
                task.execute.call(casper, pediff, task.config);
            });
        });
    });

    casper.run(function() {
        test.done();
    });
});

casper.test.begin('[' + task.config.package + '] comparing environments', 0, function suite(test) {
    casper.then(function compareEnvironments() {
        var envs = Object.keys(config.environments),
            baseEnv = envs.shift();

        envs.forEach(function(env) {
            pediff.compareEnvironments(baseEnv, env, task.config.package);
        });
    });
    casper.run(function() {
        test.done();
    });
});

casper.test.begin('[' + task.config.package + '] Converting screenshots to .jpg', 0, function convertScreenshots(test) {
    var envNames = Object.keys(config.environments).slice(0,2),
    filenameRegex = new RegExp('(\\d+_)?(\\d+x\\d+)_' + task.config.package.replace(/ /g,'-') + '(@.+)?\\.png');

    envNames.forEach(function(env) {
        var dirname = config.pediff.screenshotRoot + env + '/';
        var images = fs.list(dirname);

        fs.makeDirectory(dirname + 'hq/');
        images.forEach(function(filename) {
            if(!filenameRegex.test(filename)) return;

            var fullPath = dirname + filename;
            if(fs.isFile(fullPath)) {
                pediff.convertImageToJpg(dirname, filename);
                casper.then(function() {
                    fs.move(fullPath, dirname + 'hq/' + filename);
                });
            }
        });
    });

    casper.run(function() {
        test.done();
        casper.exit(0);
    });
});
