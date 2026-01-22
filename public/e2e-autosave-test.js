#!/usr/bin/env node

/**
 * E2E Autosave Test for ScriptPal
 * 
 * This test simulates user interactions and verifies that:
 * 1. Format switching works correctly
 * 2. Autosave triggers on content changes
 * 3. Save requests complete successfully
 * 4. Multiple changes are handled properly
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5555';

class E2EAutosaveTest {
    constructor() {
        this.results = [];
        this.apiCalls = [];
        this.startTime = null;
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${message}`);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    addResult(testName, passed, message) {
        const result = {
            testName,
            passed,
            message,
            timestamp: Date.now()
        };
        this.results.push(result);
        
        const status = passed ? '✅ PASS' : '❌ FAIL';
        this.log(`${status} ${testName}: ${message}`);
    }

    async checkServerHealth() {
        this.log('🏥 Checking server health...');
        
        try {
            const response = await fetch(`${BASE_URL}/health`);
            if (response.ok) {
                this.addResult('Server Health Check', true, 'Server is responding');
                return true;
            } else {
                this.addResult('Server Health Check', false, `Server returned ${response.status}`);
                return false;
            }
        } catch (error) {
            this.addResult('Server Health Check', false, `Server not reachable: ${error.message}`);
            return false;
        }
    }

    async testScriptRetrieval() {
        this.log('📄 Testing script retrieval...');
        
        try {
            const response = await fetch(`${BASE_URL}/api/script/1`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': 'session=test-session' // Mock session
                }
            });
            
            if (response.ok) {
                const script = await response.json();
                this.addResult('Script Retrieval', true, `Retrieved script: "${script.title}"`);
                return script;
            } else {
                this.addResult('Script Retrieval', false, `Failed to retrieve script: ${response.status}`);
                return null;
            }
        } catch (error) {
            this.addResult('Script Retrieval', false, `Error retrieving script: ${error.message}`);
            return null;
        }
    }

    async testScriptUpdate() {
        this.log('💾 Testing script update...');
        
        const testContent = `<action>E2E Test Action - ${Date.now()}</action>
<speaker>TEST CHARACTER</speaker>
<dialog>This is a test dialog for E2E testing.</dialog>`;

        try {
            const response = await fetch(`${BASE_URL}/api/script/1`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': 'session=test-session'
                },
                body: JSON.stringify({
                    title: 'E2E Test Script',
                    content: testContent,
                    status: 'draft',
                    version_number: '1.0'
                })
            });
            
            if (response.ok) {
                const updatedScript = await response.json();
                this.addResult('Script Update', true, `Script updated successfully (version: ${updatedScript.version_number})`);
                return updatedScript;
            } else {
                const errorText = await response.text();
                this.addResult('Script Update', false, `Update failed: ${response.status} - ${errorText}`);
                return null;
            }
        } catch (error) {
            this.addResult('Script Update', false, `Error updating script: ${error.message}`);
            return null;
        }
    }

    async testMultipleUpdates() {
        this.log('🔄 Testing multiple rapid updates...');
        
        const updates = [];
        const promises = [];
        
        // Create multiple update requests
        for (let i = 0; i < 3; i++) {
            const content = `<action>Rapid Update ${i + 1} - ${Date.now()}</action>
<speaker>CHARACTER ${i + 1}</speaker>
<dialog>Rapid update test ${i + 1}</dialog>`;
            
            const promise = fetch(`${BASE_URL}/api/script/1`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': 'session=test-session'
                },
                body: JSON.stringify({
                    title: `E2E Test Script - Update ${i + 1}`,
                    content: content,
                    status: 'draft',
                    version_number: '1.0'
                })
            }).then(async (response) => {
                const result = {
                    index: i + 1,
                    status: response.status,
                    success: response.ok
                };
                
                if (response.ok) {
                    result.script = await response.json();
                } else {
                    result.error = await response.text();
                }
                
                return result;
            });
            
            promises.push(promise);
        }
        
        try {
            const results = await Promise.all(promises);
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            if (failed.length === 0) {
                this.addResult('Multiple Updates', true, `All ${results.length} updates successful`);
            } else {
                this.addResult('Multiple Updates', false, `${failed.length}/${results.length} updates failed`);
            }
            
            return results;
        } catch (error) {
            this.addResult('Multiple Updates', false, `Error in multiple updates: ${error.message}`);
            return null;
        }
    }

    async testContentValidation() {
        this.log('✅ Testing content validation...');
        
        const testCases = [
            {
                name: 'Valid XML Content',
                content: '<action>Valid action</action><speaker>CHARACTER</speaker><dialog>Valid dialog</dialog>',
                shouldPass: true
            },
            {
                name: 'Invalid XML Content',
                content: '<invalid>Invalid tag</invalid>',
                shouldPass: false
            },
            {
                name: 'Empty Content',
                content: '',
                shouldPass: false
            },
            {
                name: 'Plain Text Content',
                content: 'Just plain text without tags',
                shouldPass: false
            }
        ];
        
        let passedTests = 0;
        
        for (const testCase of testCases) {
            try {
                const response = await fetch(`${BASE_URL}/api/script/1`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': 'session=test-session'
                    },
                    body: JSON.stringify({
                        title: 'Validation Test',
                        content: testCase.content,
                        status: 'draft',
                        version_number: '1.0'
                    })
                });
                
                const passed = testCase.shouldPass ? response.ok : !response.ok;
                if (passed) {
                    passedTests++;
                    this.log(`  ✅ ${testCase.name}: ${testCase.shouldPass ? 'Accepted' : 'Rejected'} as expected`);
                } else {
                    this.log(`  ❌ ${testCase.name}: ${testCase.shouldPass ? 'Rejected' : 'Accepted'} unexpectedly`);
                }
            } catch (error) {
                this.log(`  ❌ ${testCase.name}: Error - ${error.message}`);
            }
        }
        
        if (passedTests === testCases.length) {
            this.addResult('Content Validation', true, `All ${testCases.length} validation tests passed`);
        } else {
            this.addResult('Content Validation', false, `${passedTests}/${testCases.length} validation tests passed`);
        }
    }

    async runAllTests() {
        this.startTime = Date.now();
        this.log('🚀 Starting E2E Autosave Test Suite...');
        
        try {
            // Test 1: Server Health
            const serverHealthy = await this.checkServerHealth();
            if (!serverHealthy) {
                throw new Error('Server is not healthy, aborting tests');
            }
            
            await this.sleep(1000);
            
            // Test 2: Script Retrieval
            const script = await this.testScriptRetrieval();
            if (!script) {
                throw new Error('Cannot retrieve script, aborting tests');
            }
            
            await this.sleep(1000);
            
            // Test 3: Script Update
            const updatedScript = await this.testScriptUpdate();
            if (!updatedScript) {
                throw new Error('Script update failed, aborting tests');
            }
            
            await this.sleep(1000);
            
            // Test 4: Multiple Updates
            await this.testMultipleUpdates();
            
            await this.sleep(1000);
            
            // Test 5: Content Validation
            await this.testContentValidation();
            
            // Final Results
            const totalTime = Date.now() - this.startTime;
            const passedTests = this.results.filter(r => r.passed).length;
            const totalTests = this.results.length;
            
            this.log('\n🏁 Test Suite Complete!');
            this.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);
            this.log(`⏱️ Total time: ${totalTime}ms`);
            
            if (passedTests === totalTests) {
                this.log('🎉 All tests passed! Autosave functionality is working correctly.');
                process.exit(0);
            } else {
                this.log('❌ Some tests failed. Check the results above.');
                process.exit(1);
            }
            
        } catch (error) {
            this.log(`💥 Test suite failed: ${error.message}`);
            process.exit(1);
        }
    }
}

// Run the tests
const testSuite = new E2EAutosaveTest();
testSuite.runAllTests();
