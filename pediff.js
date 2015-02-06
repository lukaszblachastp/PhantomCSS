/*
James Cryer / Huddle / 2014
https://github.com/Huddle/PhantomCSS
http://tldr.huddle.com/blog/css-testing/
*/

var fs = require('fs'),
    q = require('q');

var verboseMode = false;

var _screenshotRoot = '.' + fs.separator + 'img' + fs.separator;
var _src = '.' + fs.separator + 'default';
var _failures = '.' + fs.separator + 'failures';

var exitStatus;
var _hideElements;
var _waitTimeout = 60000;
var _addLabelToFailedImage = true;
var _mismatchTolerance = 0.05;
var _resembleOutputSettings;

var _resemblePath;
var _resembleContainerPath;
var _libraryRoot;

var _environmentName = 'default';
var _packageName = 'default';
var _viewportSize = '0x0';

exports.screenshot = screenshot;
exports.waitForTests = waitForTests;
exports.waitForImagesToBeLoaded = waitForImagesToBeLoaded;
exports.init = init;
exports.update = update;
exports.turnOffAnimations = turnOffAnimations;
exports.getExitStatus = getExitStatus;
exports.setEnvironment = setEnvironment;
exports.setPackage = setPackage;
exports.clearAllScreenshots = clearAllScreenshots;
exports.setViewport = setViewport;
exports.compareEnvironments = compareEnvironments;

function update( options ) {

	function stripslash( str ) {
		return ( str || '' ).replace( /\/\//g, '/' ).replace( /\\/g, '\\' );
	}

	options = options || {};

	verboseMode = options.verbose || verboseMode;

	casper = options.casper || casper;

	_waitTimeout = options.waitTimeout || _waitTimeout;

	_libraryRoot = options.libraryRoot || _libraryRoot || '.';

	_resemblePath = _resemblePath || getResemblePath( _libraryRoot );

	_resembleContainerPath = _resembleContainerPath || ( _libraryRoot + fs.separator + 'resemblejscontainer.html' );

    _screenshotRoot = options.screenshotRoot || ('.'  + fs.separator + 'img' + fs.separator);
	_src = stripslash( _screenshotRoot ) + (_environmentName || 'default');

	_fileNameGetter = options.fileNameGetter || _fileNameGetter;

	_onPass = options.onPass || _onPass;
	_onFail = options.onFail || _onFail;
	_onTimeout = options.onTimeout || _onTimeout;
	_onNewImage = options.onNewImage || _onNewImage;
	_onComplete = options.onComplete || options.report || _onComplete;

	_hideElements = options.hideElements;

	_mismatchTolerance = options.mismatchTolerance || _mismatchTolerance;

	_resembleOutputSettings = options.outputSettings || _resembleOutputSettings;

	if ( options.addLabelToFailedImage !== undefined ) {
		_addLabelToFailedImage = options.addLabelToFailedImage;
	}
}

function init( options ) {
	update( options );
}

function getResemblePath( root ) {

    var path = [ root, 'node_modules', 'resemblejs', 'resemble.js' ].join( fs.separator );
    if ( !fs.isFile( path ) ) {
        throw "[PhantomCSS] Resemble.js not found: " + path;
    }

	return path;
}

function log(message) {
    if(verboseMode) {
	    console.log('[pediff.js] ' + message);
    }
}

function waitForImagesToBeLoaded(milliseconds) {
    var deferred = q.defer();
    log('Waiting for all images to be loaded');
    casper.waitFor(function() {
        return this.evaluate(function() {
            var images = document.getElementsByTagName('img');
            if(!images.length) return true;
            return Array.prototype.every.call(images, function(i) { return i.complete; });
        });
    }, deferred.resolve, deferred.reject, milliseconds || 5000);

    return deferred.promise;
}

function turnOffAnimations() {
	log('Turning off animations');
	casper.evaluate( function turnOffAnimations() {

		function disableAnimations() {
			if ( jQuery ) {
				jQuery.fx.off = true;
			}

			var css = document.createElement( "style" );
			css.type = "text/css";
			css.innerHTML = "* { -webkit-transition: none !important; transition: none !important; -webkit-animation: none !important; animation: none !important; }";
			document.body.appendChild( css );
		}

		if ( document.readyState !== "loading" ) {
			disableAnimations();
		} else {
			window.addEventListener( 'load', disableAnimations, false );
		}
	} );
}

function _fileNameGetter(root, filename) {
    var name = _viewportSize + '_'
        + _packageName.replace(/ /g, '-')
        + (filename ? '@' + filename.replace(/ /g, '-') : '');
	return root + fs.separator + name + '.png';
}

function screenshot( target, timeToWait, hideSelector, fileName ) {
	var name;

	if ( isComponentsConfig( target ) ) {
		for ( name in target ) {
			if ( isComponentsConfig( target[ name ] ) ) {
				waitAndHideToCapture( target[ name ].selector, name, target[ name ].ignore, target[ name ].wait );
			} else {
				waitAndHideToCapture( target[ name ], name );
			}
		}
	} else {
		if ( isNaN( Number( timeToWait ) ) && ( typeof timeToWait === 'string' ) ) {
			fileName = timeToWait;
			timeToWait = void 0;
		}
		waitAndHideToCapture( target, fileName, hideSelector, timeToWait );
	}
}

function isComponentsConfig( obj ) {
	return ( obj instanceof Object ) && ( isClipRect( obj ) === false );
}

function capture(srcPath, target) {
	try {
        if (isClipRect(target)) {
            casper.capture(srcPath, target);
        } else {
            casper.captureSelector( srcPath, target);
        }

        _onNewImage( {
            filename: srcPath
        } );
	} catch ( ex ) {
		log('Screenshot capture failed: ', ex.message);
	}
}

function isClipRect(value) {
	return (
		typeof value === 'object' &&
		typeof value.top === 'number' &&
		typeof value.left === 'number' &&
		typeof value.width === 'number' &&
		typeof value.height === 'number'
	);
}

function copyAndReplaceFile(src, dest) {
	if (fs.isFile(dest)) {
		fs.remove(dest);
	}
	fs.copy(src, dest);
}

function asyncCompare(one, two, func) {

	if ( !casper.evaluate( function () {
			return window._imagediff_;
		} ) ) {
		initClient();
	}

	casper.fill( 'form#image-diff', {
		'one': one,
		'two': two
	} );

	casper.evaluate( function ( filename ) {
		window._imagediff_.run( filename );
	}, {
		label: _addLabelToFailedImage ? one : false
	} );

	casper.waitFor(
		function check() {
			return this.evaluate( function () {
				return window._imagediff_.hasResult;
			} );
		},
		function () {

			var mismatch = casper.evaluate( function () {
				return window._imagediff_.getResult();
			} );

			if ( Number( mismatch ) ) {
				func( false, mismatch );
			} else {
				func( true );
			}

		},
		function () {
			func( false );
		},
		_waitTimeout
	);
}

function compareEnvironments(env1, env2) {
    log('Comparing environment "' + env1 + '" with "' + env2 + '"');
    var tests = [],
        deferred = q.defer(),
        files = fs.list(_screenshotRoot + env1)
            .filter(function(file) {
                return file[0] !== '.';
            }),
        filesToGo = files.length;

    if(!filesToGo) return deferred.resolve([]);

    if (!fs.isFile(_resembleContainerPath)) {
        throw new Error('[PhantomCSS] Can\'t find Resemble container. Perhaps the library root is mis configured. (' + _resembleContainerPath + ')');
    }

    function tryToResolve() {
        if(filesToGo<=0) {
            deferred.resolve(tests);
        }
    }

    files.forEach(function(filename) {
        var file1 = _screenshotRoot + env1 + fs.separator + filename;
        var file2 = _screenshotRoot + env2 + fs.separator + filename;

        var test = {
            filename: filename
        };

        tests.push(test);

        casper.thenOpen(_resembleContainerPath, function() {

            asyncCompare(file1, file2, function(isSame, mismatch) {
                filesToGo--;
                if (!isSame) {
                    test.fail = true;

                    casper.waitFor(
                        function check() {
                            return casper.evaluate(function () {
                                return window._imagediff_.hasImage;
                            });
                        },
                        function() {
                            var failFile;

                            // flattened structure for failed diffs so that it is easier to preview
                            if(mismatch) {
                                failFile = file2.substr(0,file2.length-4) + '.' + Math.round(mismatch*100) + '.fail.png';
                            } else {
                                failFile = file2.substr(0,file2.length-4) + '.fail.png';
                            }

                            casper.captureSelector(failFile, 'img');
                            test.failFile = failFile;
                            // log('Failure! Saved to: ' + failFile);

                            casper.evaluate( function () {
                                window._imagediff_.hasImage = false;
                            } );

                            if (mismatch) {
                                test.mismatch = mismatch;
                                _onFail(test); // casper.test.fail throws and error, this function call is aborted
                                return; // Just to make it clear what is happening
                            } else {
                                _onTimeout(test);
                            }
                            tryToResolve();
                        },
                        function () {
                            tryToResolve();
                        },
                        _waitTimeout
                    );
                } else {
                    test.success = true;
                    _onPass(test);
                    tryToResolve();
                }
            } );
        } );
    });

    return deferred.promise;
}

function waitForTests( tests ) {
	casper.then( function () {
		casper.waitFor( function () {
				return tests.length === tests.reduce( function ( count, test ) {
					if ( test.success || test.fail || test.error ) {
						return count + 1;
					} else {
						return count;
					}
				}, 0 );
			}, function () {
				var fails = 0,
					errors = 0;
				tests.forEach( function ( test ) {
					if ( test.fail ) {
						fails++;
					} else if ( test.error ) {
						errors++;
					}
				} );
				_onComplete( tests, fails, errors );
			}, function () {

			},
			_waitTimeout );
	} );
}

function initClient() {

	casper.page.injectJs( _resemblePath );

	casper.evaluate( function ( mismatchTolerance, resembleOutputSettings ) {

			var result;

			var div = document.createElement( 'div' );

			// this is a bit of hack, need to get images into browser for analysis
			div.style = "display:block;position:absolute;border:0;top:-1px;left:-1px;height:1px;width:1px;overflow:hidden;";
			div.innerHTML = '<form id="image-diff">' +
				'<input type="file" id="image-diff-one" name="one"/>' +
				'<input type="file" id="image-diff-two" name="two"/>' +
				'</form><div id="image-diff"></div>';
			document.body.appendChild( div );

			if ( resembleOutputSettings ) {
				resemble.outputSettings( resembleOutputSettings );
			}

			window._imagediff_ = {
				hasResult: false,
				hasImage: false,
				run: run,
				getResult: function () {
					window._imagediff_.hasResult = false;
					return result;
				}
			};

			function run( label ) {

				function render( data ) {
					var img = new Image();

					img.onload = function () {
						window._imagediff_.hasImage = true;
					};
					document.getElementById( 'image-diff' ).appendChild( img );
					img.src = data.getImageDataUrl( label );
				}

				resemble( document.getElementById( 'image-diff-one' ).files[ 0 ] ).
				compareTo( document.getElementById( 'image-diff-two' ).files[ 0 ] ).
				ignoreAntialiasing(). // <-- muy importante
				onComplete( function ( data ) {
					var diffImage;

					if ( Number( data.misMatchPercentage ) > mismatchTolerance ) {
						result = data.misMatchPercentage;
					} else {
						result = false;
					}

					window._imagediff_.hasResult = true;

					if ( Number( data.misMatchPercentage ) > mismatchTolerance ) {
						render( data );
					}

				} );
			}
		},
		_mismatchTolerance,
		_resembleOutputSettings
	);
}

function _onPass( test ) {
	casper.test.pass( 'No changes found for screenshot ' + test.filename );
}

function _onFail( test ) {
	casper.test.fail( 'Visual change found for screenshot ' + test.filename + ' (' + test.mismatch + '% mismatch)' );
}

function _onTimeout( test ) {
	casper.test.info( 'Could not complete image comparison for ' + test.filename );
}

function _onNewImage( test ) {
	casper.test.info('[' + _environmentName + '] Screenshot of ' + _packageName + ' @ ' + _viewportSize);
}

function _onComplete( tests, noOfFails, noOfErrors ) {
	exitStatus = noOfErrors + noOfFails;
}

function waitAndHideToCapture( target, fileName, hideSelector, timeToWait ) {

	casper.wait(timeToWait || 250, function() {

		var srcPath = _fileNameGetter(_src, fileName);

		if (hideSelector || _hideElements) {
			casper.evaluate( setVisibilityToHidden, {
				s1: _hideElements,
				s2: hideSelector
			} );
		}

		capture(srcPath, target);

	} ); // give a bit of time for all the images appear
}

function setVisibilityToHidden(s1, s2) {
	// executes in browser scope
	var selector;
	var elements;
	var i;

	if (jQuery) {
		if (s1) {
			jQuery(s1).css('visibility', 'hidden');
		}
		if (s2) {
			jQuery(s2).css('visibility', 'hidden');
		}
		return;
	}

	// Ensure at least an empty string
	s1 = s1 || '';
	s2 = s2 || '';

	// Create a combined selector, removing leading/trailing commas
	selector = (s1 + ',' + s2).replace(/(^,|,$)/g, '');
	elements = document.querySelectorAll(selector);
	i = elements.length;

	while (i--) {
		elements[i].style.visibility = 'hidden';
	}
}

function getExitStatus() {
	return exitStatus;
}

function setPackage(name) {
    _packageName = name || 'default';
    log('Package ' + _packageName);
}

function setEnvironment(name) {
    _environmentName = name || 'default';
    _src = _screenshotRoot + _environmentName;
    log('Environment ' + _environmentName);
}

function setViewport(width, height) {
    casper.viewport(width, height);
    _viewportSize = width+'x'+height;
    log('Viewport ' + _viewportSize);
}

function clearAllScreenshots() {
    log('Removing all screenshots from path "'+ _screenshotRoot +'"');
    fs.removeTree(_screenshotRoot);
}