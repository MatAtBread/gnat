/* Concatenative JavaScript

An exploration into using concatenative expressions within JavaScript. The basic trick (inspired by caternary) is to 
define getters on a prototype that always return their own reference, so that expressions like:

     Obj.abc.def.ghi
     
evaluate in JS. The getters themselves only _compile_ - they append calls to real functions onto an array associated
with each definition. The getters are conceptually similar to 'immediate' words in FORTH.

Since JS does not allow the syntax "Obj.abc.1.def", literals are passed as arguments to the getters, e.g.

     Obj.abc(1).def
     
which should be logically thought of as:

    .abc  (1) .def
    
ie: .abc compiles its runtime, (1) compiles the literal, .def compiles it's runtime. For brevity, literals can be 
comma separated (since they are actually function parameters):

    .abc  (1,'Hello',{foo:123}) .def

.abc compiles its runtime, (1,'Hello',{foo:123}) pushes three literals onto the stack (literal types are JS types), .def compiles
its runtime.

This means that the getters must return a function (so it can be optionally followed by parentheses for literals) which itself has the same 
prototype as all other concatenative functions.

*/

/* Force a function to be derived from a ConcantentiveFunction, with a prototype containing all other ConcantentiveFunctions, so
 * that chained getters work, eg. fn.abc.def.fn.etc */ 
require('colors');

var vm = {s:[],r:[],x:[]} ;
Function.prototype.valueOf = function() { return this.name.magenta };

function ConcatenativeFunction(fn) {
    if (fn instanceof ConcatenativeFunction)
        return fn ;
 
    if (!(fn instanceof Function))
        throw new Error("ConcatenativeFunction: "+fn.toString()+" is not a function") ;
    
    Object.setPrototypeOf(fn,Object.getPrototypeOf(this)) ;
    fn.constructor = this.constructor ;
    return fn ;
}

/* Base ConcatenativeFunction prototypes used to compile and execute */
ConcatenativeFunction.prototype = Object.create(Function.prototype) ;

var C = new ConcatenativeFunction(function _c(){
    if (arguments.length===0) {
        console.error("NO ARGS PASSED!")
        throw null ;//runitl() ;
    }

    if (vm.compiling) {
        // Compile all the arguments as literals
        vm.x.push([].slice.call(arguments)) ;
    } else {
        // Push the arguments on the stack
        [].push.apply(vm.s,[].reverse.call(arguments));
    }
    return C ;
}) ;

/* Add a native JS function to the prototypes */
ConcatenativeFunction.locations = {} ;
ConcatenativeFunction.define = function staticDefine(k,cfa,context){
    if (typeof k !== 'string') {
        throw new TypeError(JSON.stringify(k)+" is not a valid name")
    }
    var fn ;
    if (typeof cfa !== "function") {
        fn = function(){ return cfa } ;
        fn.valueOf = function() { return "[constant] "+cfa } ;
    } else {
        fn = cfa ;
    }

    ConcatenativeFunction.locations[vm.x.length] = "\n\t"+k.yellow+"\n" ;

    var runNative = function () {
        // Execute the underlying function
        var r = fn.apply(context,vm.s.splice(vm.s.length-fn.length,fn.length)) ;
        // Push the result (if there was one) on the stack
        if (r!==vm && r!==undefined)
            vm.s.push(r) ;
        return C ;
    } ;
    runNative.valueOf = function() { return "[js] ".green+k.cyan } ;

    Object.defineProperty(this.prototype,k,{
        enumerable:true,
        get(){
            if (vm.compiling && !fn.immediate) {
                if (context!==vm) {
                    vm.x.push(runNative);
                } else {
                    vm.x.push(fn);
                }
                return C;
            } else {
                return runNative() ;
            }
        }
    });
    
    Object.defineProperty(vm,'cfa',{
        get(){
            return fn ;
        },
        set(cfa){
            fn = cfa ;
        },
        configurable:true,
        enumerable:true
    }) ;
} ;

/* Add a set of functions contained within an object to a prototype */
ConcatenativeFunction.import = function staticImport(lib,pure){
    Object.getOwnPropertyNames(lib).forEach(k => {
        var desc = Object.getOwnPropertyDescriptor(lib,k) ;
        if (desc.get) {
            ConcatenativeFunction.define(k, desc.get, pure?vm:lib) ;
        } else if (desc.value) {
            ConcatenativeFunction.define(k, desc.value, pure?vm:lib) ;
        }
    }) ;
} ;

// Run an indirect-threaded loop, saving the instruction pointer and initiating the loop if necessary
function runitl(start) {
    vm.r.push(vm.i) ;
    vm.i = start ;
    if (vm.r.length===1) {
        while (vm.i !== undefined) {
            var r = vm.x[vm.i++] ;
            if (typeof r==="function")
                r = r() ;
            else
                [].push.apply(vm.s,[].reverse.call(r));
//        if (r && typeof r.then==='function')
//            return r.then(runitl,function(x){ throw x }) ;
        }
    }
}

function immediate(fn) {
    fn.immediate = true ;
    return fn ;
};

//Library functions that use native JS calling conventions
var nativelib = {
    store(a){ vm.x.push(a) },
    load(a){ return vm.x[a] },
    swap(a,b) { vm.s.push(b,a) },
    spread(arr){ vm.s.push.apply(vm.s,arr) },
    gather(idx){
        vm.s.push(vm.s.splice(vm.s.length-idx,idx)) ;
    },
    pluck(idx){
        return vm.s.splice(vm.s.length-idx-1,1)[0] ;
    },
    pick(idx){
        return (vm.s[vm.s.length-idx-1]) ;
    },
    drop(a) {},
    calljs:function(fn) {
        return fn.apply(null,vm.s.splice(vm.s.length-fn.length,fn.length)) ;
    },
    add(a,b) { return a+b },
    sub(a,b) { return a-b },
    mul(a,b) { return a*b },
    div(a,b) { return a/b },
//    '+'(a,b) { return nativelib.add.apply(this,arguments) },
    print(a) { 
        process.stdout.write(a.toString())
    }
} ;
ConcatenativeFunction.import(nativelib,false);

//Library functions that only operate on the VM - no parameters, no returns
var purelib = {
    create(){
        var name = vm.s.pop() ;
        ConcatenativeFunction.define(name,vm.x.length,vm) ;
    },
    define(){
        // An implementation in the form: .create .does <run itl>
        var name = vm.s[vm.s.length-1] ;
        purelib.create() ;
        var start = vm.cfa() ;
        vm.cfa = vm.compiling = function _defineCFA(){
            runitl(start) ;
        } ;
        vm.compiling.valueOf = function() { return "[itl] ."+name } ;
    },
    does:immediate(function _does(){
        var start ;
        vm.compiling = function _does_setcfa(){
            var link = vm.cfa() ;
            vm.cfa = function runDoes(){
                var res = link ;
                if (res!==undefined && res!==vm)
                    vm.s.push(res) ;
                
                runitl(start) ;
            } ;
            vm.cfa.valueOf = function() { return "runDoes @"+link } ;
        } ;
        vm.compiling.valueOf = function() { return "_does_setcfa @"+start }
        vm.x.push(vm.compiling,purelib.exit) ;
        start = vm.x.length ;
    }),
    exit:function exit(){
        vm.i = vm.r.pop() ;
    },
    'return':immediate(function _return(){
        vm.x.push(purelib.exit) ;
        vm.compiling = undefined ;
    }),
    immediate:immediate(function _immediate(){
        immediate(vm.compiling) ;
    }),
    here(){ return vm.x.length },
    'debugger'() { 
        console.log("\nX>",vm.x.map((x,i)=>(ConcatenativeFunction.locations[i]||"")+i+"\t"+(typeof x==="function"?x.valueOf().cyan:x)).join("\n")); 
        console.log("S>",vm.s); 
        console.log(Object.getOwnPropertyNames(ConcatenativeFunction.prototype).join())
        debugger;
    } 
} ;
ConcatenativeFunction.import(purelib,true);

module.exports = C ;
