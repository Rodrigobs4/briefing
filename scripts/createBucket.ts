import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.development') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;
// We are using Anon key for bucket operations, which might fail if RLS block bucket creations. 
// But ideally, we should use SERVICE_ROLE_KEY if we had it.
// If it fails, the user must create it directly or we need the service key.
// Let's try it:

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase keys missing!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const bucketName = 'uploads';
    console.log(`Checking if bucket '${bucketName}' exists...`);
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('Error listing buckets:', listError.message);
        process.exit(1);
    }

    const exists = buckets.find(b => b.name === bucketName);

    if (exists) {
        console.log(`Bucket '${bucketName}' already exists.`);

        // Ensure it is public
        const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
            fileSizeLimit: 2 * 1024 * 1024 // 2MB
        });
        if (updateError) {
            console.error('Failed to update bucket to public:', updateError.message);
        } else {
            console.log('Bucket updated to public successfully.');
        }
    } else {
        console.log(`Creating bucket '${bucketName}'...`);
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
            fileSizeLimit: 2 * 1024 * 1024 // 2MB
        });

        if (createError) {
            console.error('Failed to create bucket:', createError.message);
        } else {
            console.log(`Bucket '${bucketName}' created successfully.`);
        }
    }
}

main();
