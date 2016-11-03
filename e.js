var C = require('./c') ;

C
//Basic ops
('dup').define (0).pick .return
('newline').define ('\n').print .return

('foo').define
    .create .store
    .does ('foo says: ').print .load .print .newline
    .return

('sayABC','abc').foo
.sayABC

('bar').define
    .foo 
        .dup ('Storing: ').swap.add.print.newline
    .store
    .does ('bar says').print
    .return
    
(1) ('sayDEF','def').bar
.sayDEF
(2) ('sayGHI','ghi').bar
.sayGHI

.debugger
console.log("----------");
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(C)).join())
