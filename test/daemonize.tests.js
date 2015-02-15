var daemonize = require('../lib/daemonize'),
    fs = require('fs'),
    path = require('path');

describe('deamonize', function(){

    var outPath = path.join(__dirname, '../examples/testApp.out'),
        errPath = path.join(__dirname, '../examples/testApp.err');

    afterEach(function(){
        fs.unlink(outPath);
        return true;
    });

    it('should redirect the output of the app', function(done){
        fs.writeFileSync(outPath);

        var daemon = daemonize.setup({
            name: 'testApp',
            main: '../examples/testApp.js',
            stdout: fs.openSync(outPath, 'w'),
            pidfile: path.join(__dirname, '../examples/testApp.pid')
        });

        daemon.on('stopped', function(){
            fs.readFile(outPath, function(err, data){
                if(err){
                    err.message = ('Could not read output: ' + err.message);
                    done(err);
                }else{
                    done(data.toString() == 'Hello World!\n' ? null : new Error('Invalid output: ' + data));
                }
            });
        });

        daemon.start();
    });

});