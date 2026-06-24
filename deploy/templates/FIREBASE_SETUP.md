# Firebase setup for environment "{{NAME}}"

Each environment is its own Firebase project. Do these once, in order:

1. Create project
   Console -> + Add project -> name it e.g. "Xamify TMS ({{NAME}})".
   Note the project ID.

2. Enable Authentication providers
   Build -> Authentication -> Sign-in method:
     - Email/Password  -> Enable
     - Google          -> Enable (configure support email + project public name)

3. Create Firestore database
   Build -> Firestore Database -> Create database.
   Start in production mode; pick a region close to your users.

4. Add this environment's domain as an authorized domain
   Authentication -> Settings -> Authorized domains -> Add domain:
     {{FRONTEND_HOST}}

5. Register a Web app and copy its config
   Project Settings (gear) -> Your apps -> the </> (Web) icon.
   Nickname e.g. "{{NAME}} web". Copy the firebaseConfig values and paste them
   into:
     deploy/environments/{{NAME}}/frontend.env
       VITE_FIREBASE_API_KEY            = apiKey
       VITE_FIREBASE_AUTH_DOMAIN        = authDomain
       VITE_FIREBASE_PROJECT_ID         = projectId
       VITE_FIREBASE_STORAGE_BUCKET     = storageBucket
       VITE_FIREBASE_MESSAGING_SENDER_ID= messagingSenderId
       VITE_FIREBASE_APP_ID             = appId

6. Generate the Admin service-account key
   Project Settings -> Service accounts -> Generate new private key -> download JSON.
   Save it (overwrite) to:
     deploy/environments/{{NAME}}/firebase-service-account.json

7. Create your first admin user
   In the new project's Authentication, add the admin user, then create the
   matching "users" Firestore doc (see the root .env.example for the schema).

Done. Then deploy:
  .\deploy_backend.ps1  -Environment {{NAME}} -IdentityFile <path-to-key>
  .\deploy_frontend.ps1 -Environment {{NAME}} -IdentityFile <path-to-key>
