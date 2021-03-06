/*!
 * cssminify.js
 * @author ydr.me
 * @create 2014-10-23 19:47
 */


"use strict";

var fs = require('fs-extra');
var minifyCSS = require("clean-css");
var log = require('./log.js');
var dato = require('ydr-util').dato;
var typeis = require('ydr-util').typeis;
var crypto = require('ydr-util').crypto;
var path = require('path');
var options = {
    keepSpecialComments: 0,
    keepBreaks: false
};
var REG_URL = /url\(['"]?(.*?)['"]?\)([;\s\b])/ig;
var REG_REMOTE = /^(https?:)?\/\//i;
var REG_SUFFIX = /(\?.*|#.*)$/;
var REG_ABSPATH = /^\//;
var buildMap = {};
var resVerMap = {};


/**
 * 样式压缩
 * @param file
 * @param code
 * @param srcPath
 * @param destPath
 * @param destFile
 * @param config
 * @param [callback]
 */
module.exports = function (file, code, srcPath, destPath, destFile, config, callback) {
    var args = arguments;
    var hasResVersionMap = true;

    if (typeis.function(args[2])) {
        callback = args[2];
        hasResVersionMap = false;
    }

    try {
        code = new minifyCSS(options).minify(code);
        code = hasResVersionMap ? _cssUrlVersion() : code;

        if (callback) {
            callback(null, code, resVerMap);
        } else {
            return code;
        }
    } catch (err) {
        log('cssminify', dato.fixPath(file), 'error');
        log('cssminify', err.message, 'error');
        process.exit();
    }


    /**
     * CSS 引用资源路径替换
     * @returns {string}
     * @private
     */
    function _cssUrlVersion() {
        var fileDir = path.dirname(file);

        return code.replace(REG_URL, function ($0, $1, $2) {
            // 以下情况忽略添加版本号：
            // //path/to/abc.png
            // http://path/to/abc.png
            // https://path/to/abc.png
            if (REG_REMOTE.test($1)) {
                return 'url(' + $1 + ')' + $2;
            }

            var absFile = path.join(REG_ABSPATH.test($1) ? srcPath : fileDir, $1);
            var basename = path.basename(absFile);
            var srcName = basename.replace(REG_SUFFIX, '');
            var suffix = (basename.match(REG_SUFFIX) || [''])[0];

            absFile = absFile.replace(REG_SUFFIX, '');

            var url = buildMap[absFile];
            var version = resVerMap[absFile];

            if (!version) {
                version = crypto.etag(absFile);
            }

            if (!version) {
                log('read file', dato.fixPath(absFile), 'error');
                process.exit();
            }

            resVerMap[absFile] = version;

            // 未进行版本构建
            if (!url) {
                var extname = path.extname(srcName);
                var resName = version + extname;
                var resFile = path.join(destPath, config.resource.dest, resName);

                try {
                    fs.copySync(absFile, resFile);
                } catch (err) {
                    log('copy from', dato.fixPath(absFile), 'error');
                    log('copy to', dato.fixPath(resFile), 'error');
                    log('copy file', err.message, 'error');
                    process.exit();
                }

                buildMap[absFile] = url = path.relative(path.dirname(destFile), resFile);
            }

            return 'url(' + url + suffix + ')' + $2;
        });
    }
};



