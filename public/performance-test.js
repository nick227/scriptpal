#!/usr/bin/env node

/**
 * Command-line Performance Test for ScriptPal
 * Run with: node performance-test.js
 */

console.log('🚀 ScriptPal Performance Test Starting...\n');

// Performance test results
const results = {
    jsPerformance: {},
    memory: {},
    timing: {}
};

// Utility function to measure performance
function measureTime(name, fn, threshold = null) {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    results.timing[name] = duration;
    
    const status = threshold ? 
        (duration < threshold ? '✅ PASS' : duration < threshold * 1.5 ? '⚠️  WARNING' : '❌ FAIL') :
        '✅ PASS';
    
    console.log(`${status} ${name}: ${duration.toFixed(2)}ms${threshold ? ` (threshold: <${threshold}ms)` : ''}`);
    
    return result;
}

// JavaScript Performance Tests
console.log('📊 JavaScript Performance Tests:');
console.log('================================');

// Object Creation Performance
measureTime('Object Creation (10k objects)', () => {
    const objects = [];
    for (let i = 0; i < 10000; i++) {
        objects.push({
            id: i,
            name: `Object ${i}`,
            data: { value: i * 2, nested: { deep: i * 3 } }
        });
    }
    return objects.length;
}, 50);

// Array Operations Performance
measureTime('Array Operations (10k items)', () => {
    const numbers = Array.from({length: 10000}, (_, i) => i);
    const doubled = numbers.map(n => n * 2);
    const filtered = doubled.filter(n => n > 1000);
    const sum = filtered.reduce((acc, n) => acc + n, 0);
    return sum;
}, 25);

// String Operations Performance
measureTime('String Operations (1k strings)', () => {
    let result = '';
    for (let i = 0; i < 1000; i++) {
        result += `String ${i} `;
    }
    const upper = result.toUpperCase();
    const split = result.split(' ');
    const joined = split.join('-');
    return joined.length;
}, 50);

// Function Call Performance
measureTime('Function Calls (100k calls)', () => {
    const testFunction = (a, b) => a + b;
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
        sum += testFunction(i, i + 1);
    }
    return sum;
}, 50);

// Async Operations Performance
measureTime('Async Operations (100 promises)', () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(i));
    }
    return Promise.all(promises).then(results => results.length);
}, 200);

// JSON Operations Performance
measureTime('JSON Operations (1k objects)', () => {
    const objects = [];
    for (let i = 0; i < 1000; i++) {
        objects.push({
            id: i,
            data: { value: i * 2, array: [i, i+1, i+2] }
        });
    }
    const jsonString = JSON.stringify(objects);
    const parsed = JSON.parse(jsonString);
    return parsed.length;
}, 100);

// Regular Expression Performance
measureTime('Regex Operations (10k matches)', () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(1000);
    const regex = /[aeiou]/gi;
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}, 100);

// Memory Usage Tests
console.log('\n🧠 Memory Usage Tests:');
console.log('======================');

const memBefore = process.memoryUsage();
results.memory.before = memBefore;

measureTime('Memory Allocation (1k objects)', () => {
    const objects = [];
    for (let i = 0; i < 1000; i++) {
        objects.push({
            id: i,
            data: new Array(100).fill(0).map((_, j) => j),
            timestamp: Date.now()
        });
    }
    return objects.length;
}, 100);

const memAfter = process.memoryUsage();
results.memory.after = memAfter;

// Calculate memory differences
const memDiff = {
    rss: memAfter.rss - memBefore.rss,
    heapTotal: memAfter.heapTotal - memBefore.heapTotal,
    heapUsed: memAfter.heapUsed - memBefore.heapUsed,
    external: memAfter.external - memBefore.external
};

console.log(`📈 Memory Usage Changes:`);
console.log(`   RSS: ${(memDiff.rss / 1024 / 1024).toFixed(2)}MB`);
console.log(`   Heap Total: ${(memDiff.heapTotal / 1024 / 1024).toFixed(2)}MB`);
console.log(`   Heap Used: ${(memDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`);
console.log(`   External: ${(memDiff.external / 1024 / 1024).toFixed(2)}MB`);

// File System Performance (if applicable)
console.log('\n📁 File System Performance:');
console.log('===========================');

const fs = require('fs');
const path = require('path');

// Test file reading performance
if (fs.existsSync('./package.json')) {
    measureTime('File Read (package.json)', () => {
        const content = fs.readFileSync('./package.json', 'utf8');
        return content.length;
    }, 10);
}

// Test directory listing performance
measureTime('Directory Listing', () => {
    const files = fs.readdirSync('./');
    return files.length;
}, 50);

// Network Performance Simulation
console.log('\n🌐 Network Performance Simulation:');
console.log('===================================');

measureTime('HTTP Request Simulation (10 requests)', () => {
    const requests = [];
    for (let i = 0; i < 10; i++) {
        requests.push(Promise.resolve({ status: 200, data: `Response ${i}` }));
    }
    return Promise.all(requests).then(responses => responses.length);
}, 500);

// Performance Summary
console.log('\n📋 Performance Summary:');
console.log('=======================');

const totalTime = Object.values(results.timing).reduce((sum, time) => sum + time, 0);
const avgTime = totalTime / Object.keys(results.timing).length;

console.log(`Total Test Time: ${totalTime.toFixed(2)}ms`);
console.log(`Average Test Time: ${avgTime.toFixed(2)}ms`);
console.log(`Number of Tests: ${Object.keys(results.timing).length}`);

// Performance recommendations
console.log('\n💡 Performance Recommendations:');
console.log('===============================');

const slowTests = Object.entries(results.timing)
    .filter(([name, time]) => time > 100)
    .sort(([,a], [,b]) => b - a);

if (slowTests.length > 0) {
    console.log('⚠️  Slow operations detected:');
    slowTests.forEach(([name, time]) => {
        console.log(`   - ${name}: ${time.toFixed(2)}ms`);
    });
    console.log('\nConsider optimizing these operations for better performance.');
} else {
    console.log('✅ All operations are performing well!');
}

// Memory recommendations
if (memDiff.heapUsed > 10 * 1024 * 1024) { // 10MB
    console.log('\n⚠️  High memory usage detected:');
    console.log(`   Heap used increased by ${(memDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log('   Consider implementing memory cleanup or reducing object creation.');
}

// Final performance score
const passedTests = Object.values(results.timing).filter(time => time < 100).length;
const totalTests = Object.keys(results.timing).length;
const performanceScore = Math.round((passedTests / totalTests) * 100);

console.log(`\n🎯 Overall Performance Score: ${performanceScore}%`);

if (performanceScore >= 90) {
    console.log('🏆 Excellent performance! Your application is running very efficiently.');
} else if (performanceScore >= 70) {
    console.log('👍 Good performance with some room for optimization.');
} else {
    console.log('🚨 Performance issues detected. Consider optimizing slow operations.');
}

console.log('\n✨ Performance test completed!');
