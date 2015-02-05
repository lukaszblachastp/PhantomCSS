var phantomcss = require('./phantomcss.js'),
    config = require('./config.js'),
    fs = require('fs');

var tasks = fs.list('./tasks/')
    .filter(function(taskFile) {
        return taskFile.length>3 && taskFile.substr(taskFile.length-3)==='.js';
    })
    .map(function(taskFile) {
        var task = require('./tasks/' + taskFile);
        task.name = taskFile.substr(0, taskFile.length-3);
        return task;
    });

phantomcss.init(config.phantomcss);
casper.start();
casper.options.waitTimeout = 15000;
phantomcss.clearAllScreenshots();

Object.keys(config.environments).forEach(function(key) {
    var env = {
        name: key,
        url: config.environments[key]
    };

    casper.then(function testEnvironment() {
        phantomcss.setEnvironment(env.name);
    });

    tasks.forEach(function testTask(task) {
        casper.then(function setPackageName() {
            phantomcss.setPackage(task.config.package || 'default');
        });

        config.viewports.forEach(function testViewport(viewport) {
            casper.thenOpen(env.url + task.config.path);
            casper.then(function viewportTestInner() {
                phantomcss.turnOffAnimations();
                phantomcss.setViewport(viewport.width, viewport.height);
                //phantomcss.waitForImagesToBeLoaded(15000);
                task.execute.call(casper, phantomcss, task.config);
            });
        });
    });
});

casper.then(function compareEnvironments() {
    var envs = Object.keys(config.environments),
        baseEnv = envs.shift();

    envs.forEach(function(env) {
        phantomcss.compareEnvironments(baseEnv, env);
    });
});

casper.then(function finishTheTest() {
    casper.test.done();
});

casper.run(function(){
    console.log('\nTHE END');
    phantom.exit(phantomcss.getExitStatus());
});
