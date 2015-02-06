var phantomcss = require('./phantomcss.js');
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

phantomcss.init(config.phantomcss);
casper.start();
casper.options.waitTimeout = 15000;
phantomcss.clearAllScreenshots();

Object.keys(config.environments).forEach(function(key) {
    var env = {
        name: key,
        url: config.environments[key]
    };

    tasks.forEach(function testTask(task) {
        var taskConfig = task.config || {};
        casper.test.begin(taskConfig.package || 'default', 2, function suite(test) {
            casper.then(function testEnvironment() {
                phantomcss.setEnvironment(env.name);
            });

            casper.then(function setPackageName() {
                phantomcss.setPackage(taskConfig.package || 'default');
            });

            config.viewports.forEach(function testViewport(viewport) {
                casper.open(env.url + taskConfig.path);
                casper.then(function viewportTestInner() {
                    phantomcss.turnOffAnimations();
                    phantomcss.setViewport(viewport.width, viewport.height);
                    //phantomcss.waitForImagesToBeLoaded(15000);
                    task.execute.call(casper, phantomcss, taskConfig);
                });
            });

            casper.run(test.done);
        });
    });
});

casper.test.begin('comparing environments', 2, function suite(test){
    casper.then(function compareEnvironments() {
        var envs = Object.keys(config.environments),
            baseEnv = envs.shift();

        envs.forEach(function(env) {
            phantomcss.compareEnvironments(baseEnv, env);
        });
    });
    casper.run(test.done);
});


//casper.run(function(){
//    console.log('\nTHE END');
//    phantom.exit(phantomcss.getExitStatus());
//});
