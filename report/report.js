/*
 * Iterate through all screenshots made for the first environment, extract specific data
 * from file names and save them as report.json
 */
/* global phantom, casper */
var fs = require('fs'),
    utils = require('utils'),
    config = require('./../config'),
    i, j, k,
    report = {
        cacheBuster: ('' + Math.random()).replace('0.', ''),
        environments: config.environments,
        tasks: {}
    };

//load tasks configurations and map them into the report
var tasks = fs.list('tasks');

for (i = 0; i < tasks.length; i++) {
    var filename = tasks[i];

    //filter out "up one directory" links and dist file from the files list
    if (filename.indexOf('.js') === -1 || filename.indexOf('.js') !== filename.length - 3) {
        continue;
    }

    //load task configuration and use it to extend the global config
    var taskConfig = require('./../tasks/' + filename.replace('.js', '')).config;
    var taskData = utils.mergeObjects({},{ options: config });
    utils.mergeObjects(taskData,taskConfig);

    taskData.actions = taskData.actions || [];
    var task = {
        file: filename,
        actions: {},
        variants: []
    };

    //create task variants for all viewport sizes for each defined action

    for (j = 0; j < taskData.options.viewports.length; j++) {
        task.variants.push({
            viewportSize: taskData.options.viewports[j].width+'x'+taskData.options.viewports[j].height,
            media: null,
            diff: -1,
            path: taskData.path || ''
        });
    }

    for(k = 0; k < taskData.actions.length; k++) {
        var action = {
            file: filename,
            variants: []
        };
        for (j = 0; j < taskData.options.viewports.length; j++) {
            action.variants.push({
                viewportSize: taskData.options.viewports[j].width+'x'+taskData.options.viewports[j].height,
                media: null,
                diff: -1,
                path: taskData.path || ''
            });
        }
        task.actions[taskData.actions[k]] = action;
    }

    //create task variants for all defined media
    if(taskData.media) {
        for (j = 0; j < taskData.media.length; j++) {
            task.variants.push({
                viewportSize: null,
                media: taskData.media[j],
                action: null,
                diff: -1,
                path: taskData.path || ''
            });
        }
    }

    report.tasks[taskData['package']] = task;
}

//browse through analysed images and update tasks in report with difference value
// var files = fs.list('candidate/hq/');
var files = fs.list(config.pediff.screenshotRoot + 'candidate/');
for (i = 0; i < files.length; i++) {
    var filename = String(files[i]);

    var matches = /(\d+)_(\d+x\d+)(_(.[a-z]+))?_(.*)\./.exec(filename);

    if (!utils.isArray(matches)) {
        continue;
    }

    var name = matches[5].replace(/@.[^_]*/,''),
        action = /@(.[^_]*)/.exec(matches[5]),
        viewport = matches[2],
        media = matches[4],
        diff = matches[1],
        variants;

    if(action) {
        action = action[1];
    }

    if (media === undefined || media === 'null') {
        media = null;
    }

    if(action) {
        try {
            variants = report.tasks[name].actions[action].variants;
        } catch(e) {
            console.log('You probably have more than one task file in package "' + name + '"');
        }
    } else {
        try {
            variants = report.tasks[name].variants;
        } catch(e) {
            console.log('You probably use spaces in package name "' + name + '"');
        }
    }

    for(j=0; j<variants.length;j++) {
        if(variants[j].viewportSize === viewport && variants[j].media === media) {
            variants[j].diff = diff;
            break;
        }
    }
}

if(config.output.junit) {
    var junit = require('junit');
    fs.write('junit.xml', junit.generate(report), 'w');
}
if(config.output.json) {
    fs.write('report.json', JSON.stringify(report), 'w');
}
phantom.exit();
