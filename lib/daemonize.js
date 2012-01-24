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

var fs = require("fs"),
    path = require("path"),
    args = require("./args"),
    spawn = require("child_process").spawn;


exports.setup = function(options) {
    return new Daemon(options);
};

var Daemon = function(options) {
    
    if (!options.main)
        throw new Error("Expected 'main' option for daemonize");
        
    var dir = path.dirname(module.parent.filename);
    
    // normalize options
    this._options = {};
    this._options.main = path.resolve(dir, options.main);
    this._options.name = options.name || path.basename(this._options.main, ".js");

    this._options.logfile = options.logfile 
                        ? path.resolve(dir, options.logfile) 
                        : path.join("/var/log", this._options.name + ".log");
    this._options.pidfile = options.pidfile 
                        ? path.resolve(dir, options.pidfile)
                        : path.join("/var/run", this._options.name + ".pid");

    this._options.user = options.user || "";
    this._options.group = options.group || "";
};

Daemon.prototype.start = function(callback) {

    // make sure daemon is not running
    var pid = this._sendSignal(this._getpid());
    
    if (pid) {
        console.log("Daemon already running. PID: " + pid);
        if (callback)
            callback(true);
        return;
    }
    
    // check whether we have right to write to pid file
    try {
        fs.writeFileSync(this._options.pidfile, "");
    }
    catch (err) {
        if (err.code == "EACCES")
            console.log("Root privileges are required");
        else
            throw err;
            
        if (callback)
            callback(true);
        return;
    }
    
    console.log("Starting daemon...");

    // spawn child process
    var child = spawn(process.execPath, [
            __dirname + "/wrapper.js"
        ].concat(args.make(this._options))
    );
    pid = child.pid;

    // save pid
    fs.writeFileSync(this._options.pidfile, pid + "\n");

    // check if process is running
    setTimeout(function() {

        if (this._sendSignal(pid)) {
            console.log("Daemon started. PID: " + pid);
            if (callback)
                callback();
                
        } else {    
            console.log("Daemon failed to start.");
            if (callback)
                callback(true);
        }

    }.bind(this), 1000);
};

Daemon.prototype.stop = function(callback) {
    this._kill(["SIGTERM"], callback);
};

Daemon.prototype.kill = function(callback) {
    this._kill(["SIGTERM", "SIGINT", "SIGQUIT", "SIGKILL"], callback);
};

Daemon.prototype.status = function() {
    
    var pid = this._sendSignal(this._getpid());
    
    if (pid) {
        console.log("Daemon running. PID: " + pid);
    } else {
        console.log("Daemon is not running.");
    }
};

Daemon.prototype._getpid = function() {
    
    try { 
        return parseInt(fs.readFileSync(this._options.pidfile));
    } 
    catch (err) {
    }
    
    return 0;
};

Daemon.prototype._sendSignal = function(pid, signal) {
    
    if (!pid) return 0;
    
    try {
        process.kill(pid, signal || 0);
        return pid;
    } 
    catch (err) {
    }
    
    return 0;
};

Daemon.prototype._kill = function(signals, callback) {
    
    var pid = this._sendSignal(this._getpid());

    if (!pid) {
        console.log("Daemon is not running");
        return;
    }
    
    console.log("Stopping daemon...");
    
    this._tryKill(pid, signals, function(pid) {
        console.log("Daemon stopped.");
        if (callback)
            callback(pid);
    });
};

Daemon.prototype._tryKill = function(pid, signals, callback) {
    
    if (!this._sendSignal(pid, signals.length > 1 ? signals.shift() : signals[0])) {
        if (callback)
            callback(pid);
        return true;
    }
    
    setTimeout(this._tryKill.bind(this, pid, signals, callback), 2000);
    return false;
};