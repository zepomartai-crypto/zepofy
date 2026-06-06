// Debug Authentication Script
// Helps identify and fix authentication issues

const jwt = require('jsonwebtoken');

class AuthDebugger {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    }

    // Test JWT token creation and verification
    testJWT() {
        console.log('🔍 Testing JWT Authentication...\n');

        // Test 1: Check if JWT_SECRET is configured
        console.log('📋 Environment Check:');
        console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Configured' : '❌ Missing');
        console.log('   JWT Secret Length:', this.jwtSecret.length);
        console.log('');

        // Test 2: Create a test token
        const testPayload = {
            userId: 'test-user-123',
            email: 'test@example.com',
            role: 'user'
        };

        console.log('🔑 Creating Test Token...');
        let testToken;
        try {
            testToken = jwt.sign(testPayload, this.jwtSecret, { expiresIn: '1h' });
            console.log('✅ Token created successfully');
            console.log('   Token:', testToken.substring(0, 50) + '...');
            console.log('');
        } catch (error) {
            console.log('❌ Failed to create token:', error.message);
            return;
        }

        // Test 3: Verify the token
        console.log('🔐 Verifying Test Token...');
        try {
            const decoded = jwt.verify(testToken, this.jwtSecret);
            console.log('✅ Token verified successfully');
            console.log('   Decoded:', decoded);
            console.log('');
        } catch (error) {
            console.log('❌ Token verification failed:', error.message);
            console.log('   Error name:', error.name);
            return;
        }

        // Test 4: Test with wrong secret
        console.log('🚫 Testing with Wrong Secret...');
        try {
            jwt.verify(testToken, 'wrong-secret');
            console.log('❌ Should have failed with wrong secret');
        } catch (error) {
            console.log('✅ Correctly failed with wrong secret:', error.message);
        }
        console.log('');

        // Test 5: Test expired token
        console.log('⏰ Testing Expired Token...');
        try {
            const expiredToken = jwt.sign(testPayload, this.jwtSecret, { expiresIn: '-1h' });
            jwt.verify(expiredToken, this.jwtSecret);
            console.log('❌ Should have failed with expired token');
        } catch (error) {
            console.log('✅ Correctly failed with expired token:', error.message);
        }
        console.log('');

        console.log('🎉 JWT Authentication Test Complete!');
        console.log('');
        console.log('📝 Next Steps:');
        console.log('1. Make sure your frontend sends: Authorization: Bearer <token>');
        console.log('2. Test with: curl -H "Authorization: Bearer ' + testToken + '" http://localhost:3000/api/test/protected');
        console.log('3. Check server logs for detailed authentication errors');
    }

    // Generate test token for manual testing
    generateTestToken(userId = 'test-user-123') {
        const payload = {
            userId: userId,
            email: 'test@example.com',
            iat: Math.floor(Date.now() / 1000)
        };

        const token = jwt.sign(payload, this.jwtSecret);
        
        console.log('🔑 Test Token Generated:');
        console.log('   Token:', token);
        console.log('   User ID:', userId);
        console.log('');
        console.log('📝 Test Commands:');
        console.log('curl -H "Authorization: Bearer ' + token + '" \\');
        console.log('     http://localhost:3000/api/test/protected');
        console.log('');
        
        return token;
    }

    // Check common authentication issues
    checkCommonIssues() {
        console.log('🔍 Checking Common Authentication Issues...\n');

        // Check 1: JWT_SECRET
        if (!process.env.JWT_SECRET) {
            console.log('❌ ISSUE: JWT_SECRET environment variable is missing');
            console.log('   Fix: Add JWT_SECRET=your-secret-key to your .env file');
        } else if (process.env.JWT_SECRET.length < 32) {
            console.log('⚠️  WARNING: JWT_SECRET is too short (should be at least 32 characters)');
        } else {
            console.log('✅ JWT_SECRET is properly configured');
        }

        // Check 2: JWT library
        try {
            require('jsonwebtoken');
            console.log('✅ JWT library is available');
        } catch (error) {
            console.log('❌ ISSUE: JWT library not installed');
            console.log('   Fix: npm install jsonwebtoken');
        }

        // Check 3: Authorization header format
        console.log('');
        console.log('📋 Authorization Header Format:');
        console.log('   Correct: Authorization: Bearer <token>');
        console.log('   Incorrect: Authorization: <token>');
        console.log('   Incorrect: token: <token>');

        console.log('');
        console.log('🔧 Troubleshooting Steps:');
        console.log('1. Check if JWT_SECRET is set in environment');
        console.log('2. Verify Authorization header format in frontend');
        console.log('3. Check server logs for detailed error messages');
        console.log('4. Test with /api/test/public endpoint (no auth required)');
        console.log('5. Test with /api/test/generate-token to create test token');
    }
}

// CLI Usage
if (require.main === module) {
    const authDebugger = new AuthDebugger();
    const command = process.argv[2];
    
    switch (command) {
        case 'test':
            authDebugger.testJWT();
            break;
        case 'generate':
            const userId = process.argv[3] || 'test-user-123';
            authDebugger.generateTestToken(userId);
            break;
        case 'check':
            authDebugger.checkCommonIssues();
            break;
        default:
            console.log('Usage:');
            console.log('  node debug-auth.js test       # Test JWT functionality');
            console.log('  node debug-auth.js generate   # Generate test token');
            console.log('  node debug-auth.js check      # Check common issues');
            console.log('');
            authDebugger.checkCommonIssues();
    }
}

module.exports = AuthDebugger;
