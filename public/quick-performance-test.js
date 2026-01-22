#!/usr/bin/env node

/**
 * Quick Performance Test for ScriptPal
 * Run with: node quick-performance-test.js
 */

console.log('🚀 ScriptPal Quick Performance Test Starting...\n');

// Simple timing function
function timeIt(name, fn) {
    const start = Date.now();
    const result = fn();
    const end = Date.now();
    const duration = end - start;
    
    console.log(`✅ ${name}: ${duration}ms`);
    return { result, duration };
}

// Test 1: Object Creation
console.log('📊 JavaScript Performance Tests:');
console.log('================================');

const objResult = timeIt('Object Creation (10k objects)', () => {
    const objects = [];
    for (let i = 0; i < 10000; i++) {
        objects.push({
            id: i,
            name: `Object ${i}`,
            data: { value: i * 2 }
        });
    }
    return objects.length;
});

// Test 2: Array Operations
const arrayResult = timeIt('Array Operations (10k items)', () => {
    const numbers = Array.from({length: 10000}, (_, i) => i);
    const doubled = numbers.map(n => n * 2);
    const filtered = doubled.filter(n => n > 1000);
    const sum = filtered.reduce((acc, n) => acc + n, 0);
    return sum;
});

// Test 3: String Operations
const stringResult = timeIt('String Operations (1k strings)', () => {
    let result = '';
    for (let i = 0; i < 1000; i++) {
        result += `String ${i} `;
    }
    const upper = result.toUpperCase();
    const split = result.split(' ');
    const joined = split.join('-');
    return joined.length;
});

// Test 4: Function Calls
const funcResult = timeIt('Function Calls (100k calls)', () => {
    const testFunction = (a, b) => a + b;
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
        sum += testFunction(i, i + 1);
    }
    return sum;
});

// Test 5: JSON Operations
const jsonResult = timeIt('JSON Operations (1k objects)', () => {
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
});

// Memory Usage
console.log('\n🧠 Memory Usage:');
console.log('================');

const memBefore = process.memoryUsage();
console.log(`Before: RSS=${(memBefore.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(memBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);

// Do some memory-intensive work
const memoryTest = timeIt('Memory Allocation (1k objects)', () => {
    const objects = [];
    for (let i = 0; i < 1000; i++) {
        objects.push({
            id: i,
            data: new Array(100).fill(0).map((_, j) => j),
            timestamp: Date.now()
        });
    }
    return objects.length;
});

const memAfter = process.memoryUsage();
console.log(`After: RSS=${(memAfter.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);

const memDiff = {
    rss: (memAfter.rss - memBefore.rss) / 1024 / 1024,
    heap: (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024
};

console.log(`Memory Change: RSS=${memDiff.rss.toFixed(2)}MB, Heap=${memDiff.heap.toFixed(2)}MB`);

// File System Test
console.log('\n📁 File System Performance:');
console.log('===========================');

const fs = require('fs');

if (fs.existsSync('./package.json')) {
    const fileResult = timeIt('File Read (package.json)', () => {
        const content = fs.readFileSync('./package.json', 'utf8');
        return content.length;
    });
}

const dirResult = timeIt('Directory Listing', () => {
    const files = fs.readdirSync('./');
    return files.length;
});

// Summary
console.log('\n📋 Performance Summary:');
console.log('=======================');

const results = [objResult, arrayResult, stringResult, funcResult, jsonResult, memoryTest];
const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
const avgTime = totalTime / results.length;

console.log(`Total Test Time: ${totalTime}ms`);
console.log(`Average Test Time: ${avgTime.toFixed(2)}ms`);

// Performance analysis
const slowTests = results.filter(r => r.duration > 100);
if (slowTests.length > 0) {
    console.log('\n⚠️  Slow operations detected:');
    slowTests.forEach(r => {
        console.log(`   - ${r.duration}ms`);
    });
} else {
    console.log('\n✅ All operations completed quickly!');
}

// Performance score
const passedTests = results.filter(r => r.duration < 100).length;
const performanceScore = Math.round((passedTests / results.length) * 100);

console.log(`\n🎯 Performance Score: ${performanceScore}%`);

if (performanceScore >= 90) {
    console.log('🏆 Excellent performance!');
} else if (performanceScore >= 70) {
    console.log('👍 Good performance!');
} else {
    console.log('🚨 Performance issues detected.');
}

console.log('\n✨ Quick performance test completed!');
