/**
 * ==============================================================================
 * RESEND DOMAIN VERIFICATION MONITOR
 * ==============================================================================
 *
 * Description:
 * This script periodically checks the verification status of the specified
 * domain in your Resend account. It's useful for monitoring the progress of
 * domain verification without needing to manually check the Resend dashboard.
 *
 * How to Run:
 * 1. Make sure your RESEND_API_KEY is set in the backend/.env file.
 * 2. Run the script from the root of your project:
 *    node backend/checkVerification.js
 *
 * The script will check the status immediately upon starting and then every
 * 10 minutes thereafter.
 *
 * ==============================================================================
 */

const { Resend } = require('resend');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// --- Configuration ---
const DOMAIN_TO_CHECK = 'wafadentalclinic.com';
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Initialize Resend with the API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Fetches the list of domains from Resend and checks the status of a specific domain.
 */
const checkDomainStatus = async () => {
  console.log(`[${new Date().toLocaleTimeString()}] Checking verification status for: ${DOMAIN_TO_CHECK}...`);

  try {
    // The Resend SDK's `get` method for domains is not yet implemented,
    // so we fetch the list of all domains and find the one we need.
    const { data: domains, error } = await resend.domains.list();

    if (error) {
      console.error('Error fetching domains from Resend:', error.message);
      return;
    }

    const targetDomain = domains.data.find(domain => domain.name === DOMAIN_TO_CHECK);

    if (!targetDomain) {
      console.log(`Domain '${DOMAIN_TO_CHECK}' not found in your Resend account.`);
      console.log('Please ensure you have added it on https://resend.com/domains');
      return;
    }

    console.log(`-----------------------------------------`);
    console.log(`  Domain: ${targetDomain.name}`);
    console.log(`  Status: ${targetDomain.status.toUpperCase()}`);
    console.log(`  Region: ${targetDomain.region}`);
    console.log(`-----------------------------------------`);

    if (targetDomain.status === 'verified') {
      console.log('\n✅ Success! The domain is now verified.');
      console.log('You can now send emails from @wafadentalclinic.com.');
      // Stop the script once verified
      clearInterval(intervalId);
    } else {
      console.log(`\nVerification is still pending. The next check will be in 10 minutes.`);
    }

  } catch (error) {
    console.error('An unexpected error occurred:', error.message);
  }
};

// --- Main Execution ---
if (!process.env.RESEND_API_KEY) {
  console.error('FATAL: RESEND_API_KEY is not set in your .env file. Aborting.');
} else {
  // Run the check immediately on start
  checkDomainStatus();

  // Then, run it on a recurring interval
  const intervalId = setInterval(checkDomainStatus, CHECK_INTERVAL_MS);
}
