const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();
app.use(bodyParser.json());

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const followingPeopleIdsOfUser = async (username) => {
  const getTheFollowingPeopleQuery = `
   SELECT 
   following_user_id From follower
   INNER JOIN user on user.user_id = follower.follower_user_id
   WHERE 
   user.username = '${username}';
    `;
  const followingPeople = await db.all(getTheFollowingPeopleQuery);
  const arrayOfIds = followingPeople.map(
    (eachUser) => eachUser.following_user_id
  );
  return arrayOfIds;
};

// Middleware to authenticate JWT token
function authenticateToken(request, response, next) {
  const token = request.header("Authorization");
  if (!token) {
    return response.status(401).send("Invalid JWT Token");
  }

  jwt.verify(token, "your_secret_key", (error, user) => {
    if (error) {
      return response.status(401).send("Invalid JWT Token");
    }
    request.user = user;
    next();
  });
}

// API 1: Register a new user
app.post("/register", (request, response) => {
  const { username, password, name, gender } = request.body;

  // Check if the username already exists in the database
  const existingUser = db.getUserByUsername(username);
  if (existingUser) {
    return response.status(400).send("User already exists");
  }

  // Check if the password length is at least 6 characters
  if (password.length < 6) {
    return response.status(400).send("Password is too short");
  }

  // Create the user in the database
  const newUser = db.createUser(username, password, name, gender);
  return response.status(200).send("User created successfully");
});

// API 2: User login
app.post("/login", (request, response) => {
  const { username, password } = request.body;

  // Check if the user exists in the database
  const user = db.getUserByUsername(username);
  if (!user) {
    return response.status(400).send("Invalid user");
  }

  // Check if the password is correct
  if (user.password !== password) {
    return response.status(400).send("Invalid password");
  }

  // Generate and return the JWT token
  const jwtToken = jwt.sign({ username }, "your_secret_key", {
    expiresIn: "1h",
  });
  return response.status(200).send(jwtToken);
});

// API 3: Returns the latest tweets of people whom the user follows.
app.get("/user/tweets/feed", authenticateToken, (request, response) => {
  const { username } = request.user;

  // Get the user ID from the username
  const userId = db.getUserIdByUsername(username);

  // Fetch the latest tweets of people the user follows
  const tweets = db.getLatestFollowedTweets(userId);
  return response.status(200).send(tweets);
});

// API 4: Returns the list of all names of people whom the user follows
app.get("/user/following", authenticateToken, (request, response) => {
  const { username } = request.user;

  // Get the user ID from the username
  const userId = db.getUserIdByUsername(username);

  // Fetch the list of people the user follows
  const following = db.getFollowingNames(userId);
  return response.status(200).send(following);
});

// API 5: Returns the list of all names of people who follow the user
app.get("/user/followers", authenticateToken, (request, response) => {
  const { username } = request.user;

  // Get the user ID from the username
  const userId = db.getUserIdByUsername(username);

  // Fetch the list of followers of the user
  const followers = db.getFollowerNames(userId);
  return response.status(200).send(followers);
});

// API 6: Returns the tweet details, likes count, replies count, and date-time
app.get("/tweets/:tweetId", authenticateToken, (request, response) => {
  const { username } = req.user;
  const tweetId = request.params.tweetId;

  // Check if the user follows the owner of the tweet
  const tweetOwner = db.getTweetOwner(tweetId);
  if (!db.isUserFollowing(username, tweetOwner)) {
    return response.status(401).send("Invalid Request");
  }

  // Fetch tweet details, likes count, replies count, and date-time
  const tweetDetails = db.getTweetDetails(tweetId);
  return response.status(200).send(tweetDetails);
});

// API 7: Returns the list of usernames who liked the tweet
app.get("/tweets/:tweetId/likes", authenticateToken, (request, response) => {
  const { username } = request.user;
  const tweetId = request.params.tweetId;

  // Check if the user follows the owner of the tweet
  const tweetOwner = db.getTweetOwner(tweetId);
  if (!db.isUserFollowing(username, tweetOwner)) {
    return response.status(401).send("Invalid Request");
  }

  // Fetch the list of usernames who liked the tweet
  const likes = db.getTweetLikes(tweetId);
  return response.status(200).send(likes);
});

// API 8: Returns the list of replies to a tweet
app.get("/tweets/:tweetId/replies", authenticateToken, (request, response) => {
  const { username } = request.user;
  const tweetId = request.params.tweetId;

  // Check if the user follows the owner of the tweet
  const tweetOwner = db.getTweetOwner(tweetId);
  if (!db.isUserFollowing(username, tweetOwner)) {
    return response.status(401).send("Invalid Request");
  }

  // Fetch the list of replies to a tweet
  const replies = db.getTweetReplies(tweetId);
  return response.status(200).send(replies);
});

// API 9: Returns a list of all tweets of the user
app.get("/user/tweets", authenticateToken, (request, response) => {
  const { username } = request.user;

  // Get the user ID from the username
  const userId = db.getUserIdByUsername(username);

  // Fetch a list of all tweets of the user
  const userTweets = db.getUserTweets(userId);
  return response.status(200).send(userTweets);
});

// API 10: Create a tweet in the tweet table
app.post("/user/tweets", authenticateToken, (request, response) => {
  const { username } = request.user;
  const { tweet } = request.body;

  // Get the user ID from the username
  const userId = db.getUserIdByUsername(username);

  // Create a tweet in the tweet table
  db.createTweet(tweet, userId);
  return response.status(201).send("Created a Tweet");
});

// API 11: Delete a tweet
app.delete("/tweets/:tweetId", authenticateToken, (request, response) => {
  const { username } = request.user;
  const tweetId = request.params.tweetId;

  // Check if the user is the owner of the tweet
  const tweetOwner = db.getTweetOwner(tweetId);
  if (tweetOwner !== username) {
    return response.status(401).send("Invalid Request");
  }

  // Delete the tweet from the database
  db.deleteTweet(tweetId);
  return response.status(200).send("Tweet Removed");
});
module.exports = app;
