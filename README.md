# Note: this guide assumes that you are using VS Code; the process for other IDEs may be slightly different.

First, prior to anything else, take the ".env" file found in the Elearning submission, and put it into ChosenRepoFolder/frontend.


Next, make sure you have npm installed on your computer. To do this, install node.js on your computer if you don't have it already, which can be found at https://nodejs.org/en. Make sure it works by running "npm -v" in your VS Code terminal. If it shows that there is an error, you may need to add the file path to node.js to your PATH environmental variable.

Next, you need to install some dependencies used on the frontend and backend side.

For the frontend, first go into the frontend directory from the terminal with "cd frontend". Then, inside run "npm install" in your terminal, which should install all the major components. You'll know it succeeded if you see a file called "node_modules" be made. Note that this may take a while to run.

Afterwards, return to the original directory with "cd ..", and go into the backend directory with "cd backend". Likewise, run "npm install" in your terminal within this directory. Again, you'll know it succeeded if you see a file called "node_modules" be made. Note that this may take a while to run.

Now, to actually run the program, 2 things need to be done: first is running the backend server. To run it, while still in the backend folder, run "npm run dev" in your terminal. You should see something printed to the terminal saying "socket server listening on {port number}". Now, so that you don't accidentally close the server, open another terminal in VS code. Navigate this back to the frontend folder using cd commands, then run "npm run dev". It will print out a website such as "http://localhost:300" and say "starting... ready in ___ms", which means it succeeded.

To now view the application, if you want to run 2 clientws from the same computer, open the URL "http://localhost:3000" in two separate browsers. Then, use the website as normal.
# Make sure to sign in with tow separate accounts for each browser; don't use the same google/github account for both.

You should be able to see both clients on both browsers communicate with the backend server to connect with each other now.

However, if you wanted to try communication between different devices, this is also possible, with one change required. When visited the computer with teh same website that the code is running on, going to "http://localhost:3000" will suffice. However, if say you are trying to access the website from a phone, you **cannot** go to this website. Instead, you want to replace localhost with the ip address that the computer is using. Finding this is very simple; when runing "npm run dev", you'll see alongside "Local: http://localhost:3000" the line "Network: http://IP_ADDR:3000". Basically, you just have to visit this website from the other ddvice, instead of localhost. Attached is an image to visualize this clearer. As a reminder, visiting http://localhost:3000 will work fine if it's the same computer the program's running on, otherwise you must go to the ip address directly with the URL.

Now, you should see the communications work perfectly! Just make sure all related devices are on the same local network.

As a final unrelated not, when navigating to pages, sometimes it will take a really long time for all the elements to load, up to ~15 seconds. It is loading a new page though, which you can tell from the URL changing.