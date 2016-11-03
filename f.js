var C = require('./c') ;

C
// Basic ops
('dup').define (0).pick .return
('crlf').define ('\n').print .return

('test').define
    (123).print.crlf
    (456).print.crlf
    .return
    
('x').create (10).store
.x .dup .load
.debugger
