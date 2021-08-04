const express = require("express");

const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at 3000");
    });
  } catch (e) {
    console.log(e.message);
  }
};

initializeDBAndServer();

// Registration API

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const userExists = await db.get(getUserQuery);
  if (userExists !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const decryptedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
          INSERT INTO user (username, password,name,gender)
          VALUES ('${username}', '${decryptedPassword}', '${name}', '${gender}');`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

// login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  let payload;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const userExists = await db.get(getUserQuery);
  if (userExists === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      userExists.password
    );
    if (isPasswordMatched === true) {
      payload = { username: username };
      const jwtToken = jwt.sign(payload, "Secret_code");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Authenticate Token Middleware function

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  const jwtToken = authHeader.split(" ")[1];
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Secret_code", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// covert object to array
const usernameArray = (dbObject) => {
  let array = [];
  for (let eachObject of dbObject) {
    array.push(eachObject.username);
  }
  return array;
};
//latest tweets of user
const convertTweetObjectToResponseObject = (tweet) => {
  return {
    username: tweet.username,
    tweet: tweet.tweet,
    dateTime: tweet.date_time,
  };
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getTweetsQuery = `
  SELECT username, tweet, date_time
  FROM user natural join tweet
  WHERE user_id in (
      SELECT following_user_id FROM follower WHERE follower_user_id = (
          SELECT user_id FROM user WHERE username = '${username}'
      )
  )order by date_time DESC
   LIMIT 4;`;
  const tweetsArray = await db.all(getTweetsQuery);
  response.send(
    tweetsArray.map((eachTweet) =>
      convertTweetObjectToResponseObject(eachTweet)
    )
  );
});

// Following list API

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getFollowingQuery = `
    SELECT name
    FROM user 
    WHERE user_id in (SELECT following_user_id FROM follower WHERE follower_user_id = (
       SELECT user_id FROM user WHERE username= '${username}' 
    ) )`;
  const namesList = await db.all(getFollowingQuery);
  response.send(namesList);
});

// followers list API

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getFollowingQuery = `
    SELECT name
    FROM user 
    WHERE user_id in (SELECT follower_user_id FROM follower WHERE following_user_id = (
       SELECT user_id FROM user WHERE username= '${username}' 
    ) )`;
  const namesList = await db.all(getFollowingQuery);
  response.send(namesList);
});

// get a tweet

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const userQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
  const userIdOfTweet = await db.get(userQuery);
  const followerQuery = `SELECT user_id from user WHERE user_id in (
      SELECT following_user_id FROM follower WHERE follower_user_id = (
          SELECT user_id FROM user WHERE username= '${username}'
      )
      );`;
  const userIdOfFollowers = await db.all(followerQuery);
  const isUserPresent = userIdOfFollowers.some(
    (eachUser) => eachUser.user_id === userIdOfTweet.user_id
  );
  if (isUserPresent === true) {
    const getTweetDetailsQuery = `
   SELECT t.tweet,
           COUNT(DISTINCT t.like_id) AS likes,
           COUNT(DISTINCT reply.reply_id) as replies,
           t.date_time as dateTime
   FROM (tweet JOIN like ON tweet.tweet_id = like.tweet_id) AS t 
    JOIN reply ON tweet.tweet_id = reply.tweet_id
    WHERE t.tweet_id =${tweetId};`;
    const tweet = await db.get(getTweetDetailsQuery);
    response.send(tweet);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

// likes API

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const userIdOfTweet = await db.get(userQuery);
    const followerQuery = `SELECT user_id from user WHERE user_id in (
      SELECT following_user_id FROM follower WHERE follower_user_id = (
          SELECT user_id FROM user WHERE username= '${username}'
      )
      );`;
    const userIdOfFollowers = await db.all(followerQuery);
    const isUserPresent = userIdOfFollowers.some(
      (eachUser) => eachUser.user_id === userIdOfTweet.user_id
    );
    if (isUserPresent === true) {
      console.log("true block");
      const getLikedUsersQuery = `
       SELECT username 
       FROM like NATURAL JOIN user
       WHERE tweet_id = ${tweetId};`;
      const likedUsers = await db.all(getLikedUsersQuery);
      response.send({ likes: usernameArray(likedUsers) });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// reply API

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const userIdOfTweet = await db.get(userQuery);
    const followerQuery = `SELECT user_id from user WHERE user_id in (
      SELECT following_user_id FROM follower WHERE follower_user_id = (
          SELECT user_id FROM user WHERE username= '${username}'
      )
      );`;
    const userIdOfFollowers = await db.all(followerQuery);
    const isUserPresent = userIdOfFollowers.some(
      (eachUser) => eachUser.user_id === userIdOfTweet.user_id
    );
    if (isUserPresent === true) {
      const getRepliesQuery = `
        SELECT user.name,reply.reply FROM reply NATURAL JOIN user
        WHERE tweet_id = ${tweetId};`;
      const repliedUsers = await db.all(getRepliesQuery);
      response.send({ replies: repliedUsers });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// user tweets

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserTweets = `SELECT t.tweet,
           COUNT(DISTINCT t.like_id) AS likes,
           COUNT(DISTINCT reply.reply_id) AS replies,
           t.date_time as dateTime
    FROM (tweet JOIN like ON tweet.tweet_id = like.tweet_id) AS t 
    JOIN reply ON tweet.tweet_id = reply.tweet_id
    WHERE t.user_id = (SELECT user_id FROM user WHERE username= '${username}')
    GROUP BY t.tweet_id;
`;
  const tweets = await db.all(getUserTweets);
  response.send(tweets);
});

// create a tweet

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  const getUserQuery = `Select * from user where username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const dateTime = new Date();
  const createTweetQuery = `
  INSERT INTO tweet (tweet,user_id,date_time)
  VALUES('${tweet}', ${dbUser.user_id}, '${dateTime}' );`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

// Delete a tweet

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const userIdOfTweet = await db.get(userQuery);
    const getUserQuery = `Select user_id from user where username = '${username}';`;
    const loggedInUserId = await db.get(getUserQuery);
    if (userIdOfTweet.user_id === loggedInUserId.user_id) {
      const deleteTweetQuery = `
      DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// export syntax

module.exports = app;
