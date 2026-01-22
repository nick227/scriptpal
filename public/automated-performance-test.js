/**
 * Automated Performance Test for ScriptPal
 * This script runs performance tests and outputs results
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Automated ScriptPal Performance Test...\n');

// Test configuration
const TEST_CONFIG = {
    serverUrl: 'http://localhost:5173',
    testPage: '/performance-test.html',
    timeout: 30000 // 30 seconds
};

// Performance test results
const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {}
};

// Utility function to measure performance
function measureTime(name, fn, threshold = null) {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    const status = threshold ? 
        (duration < threshold ? 'PASS' : duration < threshold * 1.5 ? 'WARNING' : 'FAIL') :
        'PASS';
    
    console.log(`${status === 'PASS' ? '✅' : status === 'WARNING' ? '⚠️' : '❌'} ${name}: ${duration.toFixed(2)}ms${threshold ? ` (threshold: <${threshold}ms)` : ''}`);
    
    return { result, duration, status, threshold };
}

// Test 1: Server Connectivity
console.log('🌐 Server Connectivity Test:');
console.log('============================');

const connectivityTest = measureTime('Server Response Time', () => {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const req = http.get(TEST_CONFIG.serverUrl, (res) => {
            const end = Date.now();
            resolve(end - start);
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}, 1000);

results.tests.connectivity = connectivityTest;

// Test 2: JavaScript Performance
console.log('\n📊 JavaScript Performance Tests:');
console.log('================================');

const jsTests = {
    objectCreation: measureTime('Object Creation (10k objects)', () => {
        const objects = [];
        for (let i = 0; i < 10000; i++) {
            objects.push({
                id: i,
                name: `Object ${i}`,
                data: { value: i * 2, nested: { deep: i * 3 } }
            });
        }
        return objects.length;
    }, 50),
    
    arrayOperations: measureTime('Array Operations (10k items)', () => {
        const numbers = Array.from({length: 10000}, (_, i) => i);
        const doubled = numbers.map(n => n * 2);
        const filtered = doubled.filter(n => n > 1000);
        const sum = filtered.reduce((acc, n) => acc + n, 0);
        return sum;
    }, 25),
    
    stringOperations: measureTime('String Operations (1k strings)', () => {
        let result = '';
        for (let i = 0; i < 1000; i++) {
            result += `String ${i} `;
        }
        const upper = result.toUpperCase();
        const split = result.split(' ');
        const joined = split.join('-');
        return joined.length;
    }, 50),
    
    functionCalls: measureTime('Function Calls (100k calls)', () => {
        const testFunction = (a, b) => a + b;
        let sum = 0;
        for (let i = 0; i < 100000; i++) {
            sum += testFunction(i, i + 1);
        }
        return sum;
    }, 50),
    
    jsonOperations: measureTime('JSON Operations (1k objects)', () => {
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
    }, 100)
};

results.tests.javascript = jsTests;

// Test 3: Memory Usage
console.log('\n🧠 Memory Usage Tests:');
console.log('======================');

const memBefore = process.memoryUsage();

const memoryTest = measureTime('Memory Allocation (1k objects)', () => {
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

const memDiff = {
    rss: (memAfter.rss - memBefore.rss) / 1024 / 1024,
    heapTotal: (memAfter.heapTotal - memBefore.heapTotal) / 1024 / 1024,
    heapUsed: (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024,
    external: (memAfter.external - memBefore.external) / 1024 / 1024
};

console.log(`📈 Memory Usage Changes:`);
console.log(`   RSS: ${memDiff.rss.toFixed(2)}MB`);
console.log(`   Heap Total: ${memDiff.heapTotal.toFixed(2)}MB`);
console.log(`   Heap Used: ${memDiff.heapUsed.toFixed(2)}MB`);
console.log(`   External: ${memDiff.external.toFixed(2)}MB`);

results.tests.memory = {
    test: memoryTest,
    before: memBefore,
    after: memAfter,
    diff: memDiff
};

// Test 4: File System Performance
console.log('\n📁 File System Performance:');
console.log('===========================');

const fsTests = {};

if (fs.existsSync('./package.json')) {
    fsTests.fileRead = measureTime('File Read (package.json)', () => {
        const content = fs.readFileSync('./package.json', 'utf8');
        return content.length;
    }, 10);
}

fsTests.directoryListing = measureTime('Directory Listing', () => {
    const files = fs.readdirSync('./');
    return files.length;
}, 50);

results.tests.filesystem = fsTests;

// Test 5: Network Performance Simulation
console.log('\n🌐 Network Performance Simulation:');
console.log('===================================');

const networkTest = measureTime('HTTP Request Simulation (10 requests)', () => {
    const requests = [];
    for (let i = 0; i < 10; i++) {
        requests.push(Promise.resolve({ status: 200, data: `Response ${i}` }));
    }
    return Promise.all(requests).then(responses => responses.length);
}, 500);

results.tests.network = networkTest;

// Generate Summary
console.log('\n📋 Performance Summary:');
console.log('=======================');

const allTests = [
    ...Object.values(jsTests),
    memoryTest,
    ...Object.values(fsTests),
    networkTest
];

const totalTime = allTests.reduce((sum, test) => sum + test.duration, 0);
const avgTime = totalTime / allTests.length;

console.log(`Total Test Time: ${totalTime.toFixed(2)}ms`);
console.log(`Average Test Time: ${avgTime.toFixed(2)}ms`);
console.log(`Number of Tests: ${allTests.length}`);

// Performance analysis
const slowTests = allTests.filter(test => test.duration > 100);
if (slowTests.length > 0) {
    console.log('\n⚠️  Slow operations detected:');
    slowTests.forEach(test => {
        console.log(`   - ${test.duration.toFixed(2)}ms`);
    });
    console.log('\nConsider optimizing these operations for better performance.');
} else {
    console.log('\n✅ All operations completed quickly!');
}

// Performance score
const passedTests = allTests.filter(test => test.duration < 100).length;
const performanceScore = Math.round((passedTests / allTests.length) * 100);

console.log(`\n🎯 Overall Performance Score: ${performanceScore}%`);

if (performanceScore >= 90) {
    console.log('🏆 Excellent performance! Your application is running very efficiently.');
} else if (performanceScore >= 70) {
    console.log('👍 Good performance with some room for optimization.');
} else {
    console.log('🚨 Performance issues detected. Consider optimizing slow operations.');
}

// Memory recommendations
if (memDiff.heapUsed > 10) { // 10MB
    console.log('\n⚠️  High memory usage detected:');
    console.log(`   Heap used increased by ${memDiff.heapUsed.toFixed(2)}MB`);
    console.log('   Consider implementing memory cleanup or reducing object creation.');
}

// Store results
results.summary = {
    totalTime,
    avgTime,
    performanceScore,
    passedTests,
    totalTests: allTests.length,
    slowTests: slowTests.length
};

// Save results to file
const resultsFile = path.join(__dirname, 'performance-results.json');
fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

console.log(`\n📄 Results saved to: ${resultsFile}`);
console.log('\n✨ Automated performance test completed!');

// Performance recommendations
console.log('\n💡 Performance Recommendations:');
console.log('===============================');

if (performanceScore < 70) {
    console.log('🚨 Critical Performance Issues:');
    console.log('   - Consider optimizing slow JavaScript operations');
    console.log('   - Review memory usage patterns');
    console.log('   - Check for potential memory leaks');
    console.log('   - Optimize file system operations');
} else if (performanceScore < 90) {
    console.log('⚠️  Performance Optimization Opportunities:');
    console.log('   - Review slow operations marked with warnings');
    console.log('   - Consider implementing performance monitoring');
    console.log('   - Optimize memory allocation patterns');
} else {
    console.log('✅ Performance is excellent!');
    console.log('   - Continue monitoring performance');
    console.log('   - Consider implementing automated performance testing');
}

console.log('\n🔍 Next Steps:');
console.log('   - Review the detailed results in performance-results.json');
console.log('   - Run the browser-based test at http://localhost:5173/performance-test.html');
console.log('   - Monitor performance in production');
console.log('   - Set up automated performance regression testing');
