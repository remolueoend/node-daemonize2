// Copyright (c) 2012 Kuba Niegowski
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

"use strict";

var util = require("util"),
    fs = require("fs"),
    args = require("./args"),
    daemonize = require("../build/Release/daemonize"); 


// parse arguments
var options = args.parse(process.argv.slice(2));


// remove pidfile on exit
if (options.pidfile)
    process.on("exit", fs.unlinkSync.bind(fs, options.pidfile));


// need to handle uncaught exceptions to be able to log that
process.on('uncaughtException', function (err) {
    
    util.log('Caught exception: ' + err);

    process.stdout.on("close", function() {
        process.exit(100);
    });
    process.stdout.end();
});


// daemonize process
if (closeStdio(options.logfile) 
        && createProcessGroup() 
        && changeUser(options.user, options.group)) {

    // run main module
    
    // first check if module exists
    var module = null;
    try {
        module = require.resolve(options.main);
    } 
    catch (err) {
        util.error("Can't load main module: " + err);
    }
    
    // ok we can start main module
    if (module) {
        
        // ok rename process
        if (options.name)
            process.title = options.name;
        
        // and run it
        require(options.main);
    }
}


function createProcessGroup() {
    
    if (daemonize.setsid() < 0) {
        util.error("setsid failed");
        return false;
    }
    
    util.log("Created new process group");
    
    return true;
}

function closeStdio(logfile) {

    // reopen to /dev/null
    daemonize.closeStdio();
    
    // remove getters
    delete process.stdout;
    delete process.stderr;
    
    // set new stdout and stderr to log file
    if (logfile) {
        process.stdout = process.stderr = fs.createWriteStream(logfile, {
            flags: "a", mode: parseInt("0644", 8), encoding: "utf8" 
        });
        util.log("Stdout and stderr redirected to " + logfile);
    }
    
    return true;
}

function changeUser(user, group) {

    if (user || group) {
        try {
            // after reducing user privs we won't be able to do some stuff
            // so first switch group and then user
            
            if (group) process.setgid(group);
            if (user) process.setuid(user);
            
            util.log("Changed process uid:gid - " + process.getuid() + ":" + process.getgid());
        }
        catch (err) { 
            urils.error("Failed to set uid or gid");
            return false;
        } 
    }
    return true;
}
