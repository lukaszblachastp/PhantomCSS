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
        throw "Unable to find task: " + tasks[0];
    }
    tasks[0] = require(tasksPath + tasks[0] + '.js');
}

pediff.init(config.pediff);
casper.start();
pediff.clearAllScreenshots();

// casper.on('remote.message', function(msg) {
//     this.echo('remote message caught: ' + msg);
// });
// casper.on("page.error", function logRemoteError(msg, trace) {
//     this.echo("Remote error:    " + msg, "ERROR");
//     this.echo("file:     " + trace[0].file, "WARNING");
//     this.echo("line:     " + trace[0].line, "WARNING");
//     this.echo("function: " + trace[0]["function"], "WARNING");
// });



tasks.forEach(function testTask(task) {
    var taskConfig = task.config || {};
    casper.test.begin(taskConfig.package || 'default', 2, function suite(test) {

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
                    pediff.waitForImagesToBeLoaded();
                    task.execute.call(casper, pediff, taskConfig);
                });
            });
        });

        casper.run(function() {
            test.done();
        });
    });
});

casper.test.begin('comparing environments', 2, function suite(test){
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
