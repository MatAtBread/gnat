var C = require('./c') ;

C
// Basic ops
('dup').define (0).pick .return
('crlf').define ('\n').print .return

//Object functions
('keys').define
    (o=>Object.keys(o)) .calljs
    .return

('members').define
    (o=>Object.keys(o).map(k=>o[k])) .calljs
    .return

('dot').define
    ((field,o)=>o[field]) .calljs
    .return 
    
// Tests
('test').define
    (123,456).add
    (11).swap.print.print.crlf
    .return

('mat').define
    ("Hello Mat").print.crlf
    .test
    ("ok").print.crlf
    .return

('Hi').define.immediate
    ('hi, immediately').print.crlf
    .return

('a').define
    (123).Hi.print.return

('var').define
    .swap .create .store
    .return

('printer').define
    .dup .create .store 
    .does .load (' ').add .print
    .return

('hello').printer
.hello.crlf
('Matthew').printer
.hello.Matthew.crlf

('native').define /* name, function */
    .create .store
    .does .load .calljs 
    .return

('require',require).native

('import').define
    .dup .create 
    .require
    .store
    .does 
    .load 
    // Now we have the module, import all its members
//    .dup .members .print.crlf
    .dot 
    .return

('fs').import

('package.json') ('readFileSync').fs .calljs .print

.debugger

console.log("----------");
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(C)).join())
