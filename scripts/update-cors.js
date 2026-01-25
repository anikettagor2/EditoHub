const { Storage } = require('@google-cloud/storage');

async function updateCors() {
    const storage = new Storage({
        projectId: 'studio-4633365007-23d80'
    });

    // The bucket name might need to be 'studio-4633365007-23d80.appspot.com' or just the project ID.
    // We'll try the one from config first.
    const bucketName = 'studio-4633365007-23d80.firebasestorage.app';

    try {
        const [metadata] = await storage.bucket(bucketName).getMetadata();
        console.log(`Bucket "${bucketName}" exists.`);

        await storage.bucket(bucketName).setCorsConfiguration([
            {
                method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
                origin: ['*'],
                responseHeader: ['Content-Type', 'Access-Control-Allow-Origin'],
                maxAgeSeconds: 3600,
            },
        ]);

        console.log(`CORS configuration updated for bucket ${bucketName}`);
    } catch (error) {
        if (error.code === 404) {
            // Try fallback bucket name
            const fallbackBucket = 'studio-4633365007-23d80.appspot.com';
            console.log(`Bucket ${bucketName} not found. Trying ${fallbackBucket}...`);
            try {
                await storage.bucket(fallbackBucket).setCorsConfiguration([
                    {
                        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
                        origin: ['*'],
                        responseHeader: ['Content-Type', 'Access-Control-Allow-Origin'],
                        maxAgeSeconds: 3600,
                    },
                ]);
                console.log(`CORS configuration updated for bucket ${fallbackBucket}`);
            } catch (err2) {
                if (err2.code === 404) {
                    const fallbackBucket2 = 'studio-4633365007-23d80';
                    console.log(`Bucket ${fallbackBucket} not found. Trying ${fallbackBucket2}...`);
                    try {
                        await storage.bucket(fallbackBucket2).setCorsConfiguration([
                            {
                                method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
                                origin: ['*'],
                                responseHeader: ['Content-Type', 'Access-Control-Allow-Origin'],
                                maxAgeSeconds: 3600,
                            },
                        ]);
                        console.log(`CORS configuration updated for bucket ${fallbackBucket2}`);
                    } catch (err3) {
                        console.error('Error updating CORS on 2nd fallback:', err3.message);
                    }
                } else {
                    console.error('Error updating CORS on fallback:', err2.message);
                }
            }
        } else {
            console.error('Error updating CORS:', error.message);
        }
    }
}

updateCors().catch(console.error);
