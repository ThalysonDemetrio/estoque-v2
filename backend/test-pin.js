import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
console.log('PIN:', process.env.INVESTIMENTOS_TAB_PIN);
