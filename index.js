require("dotenv").config();
const config = require("./config.json");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { authenticateToken } = require("./utilities");

const User = require("./models/user.model");
const PictureBook = require("./models/pictureBook.model");

mongoose
  .connect(config.connectionString)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((error) => {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1); // Exit the app if DB connection fails
  });

const jwt = require("jsonwebtoken");
const upload = require("./multer");
const app = express();

app.use(express.json());
app.use(cors({ origin: "*" }));

// create account api
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    return res
      .status(400)
      .json({ error: true, message: "All fields required" });
  }
  const isUser = await User.findOne({ email });
  if (isUser) {
    return res.status(400).json({ error: true, message: "User already exist" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    fullName,
    email,
    password: hashedPassword,
  });
  await user.save();
  const accessToken = jwt.sign(
    {
      userId: user._id,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "72h",
    }
  );
  return res.status(201).json({
    error: false,
    user: { fullName: user.fullName, email: user.email },
    accessToken,
    message: "Registration Successful",
  });
});

// login api
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: true, message: "Fill all the fields" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: "Invalid Credentials" });
  }
  const accessToken = jwt.sign(
    {
      userId: user._id,
    },
    process.env.ACCESS_TOKEN_SECRET
  );

  return res.status(200).json({
    error: false,
    user: { fullName: user.fullName, email: user.email },
    accessToken,
    message: "Login Successful",
  });
});

app.get("/get-user", authenticateToken, async (req, res) => {
  const { userId } = req.user;
  const isUser = await User.findOne({ _id: userId });
  if (!isUser) return res.sendStatus(401);
  return res.json({
    user: isUser,
    message: "",
  });
});

// add new picture book api
app.post("/add-book", authenticateToken, async (req, res) => {
  const { title, story, visitedLocation, imageURL, visitedDate } = req.body;
  const { userId } = req.user;
  if (!title || !story || !visitedLocation || !imageURL || !visitedDate) {
    return res
      .status(400)
      .json({ error: true, message: "All fields are required" });
  }

  const parsedVisitedDate = new Date(parseInt(visitedDate));

  try {
    const pictureBook = new PictureBook({
      title,
      story,
      visitedLocation,
      userId,
      imageURL,
      visitedDate: parsedVisitedDate,
    });

    await pictureBook.save();
    return res
      .status(201)
      .json({ book: pictureBook, message: "Picture Added Successfully" });
  } catch (error) {
    res.status(400).json({ error: true, message: error.message });
  }
});

// edit picture book
app.patch("/edit-book/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, story, visitedLocation, imageURL, visitedDate } = req.body;
  const { userId } = req.user;
  if (!title || !story || !visitedLocation || !visitedDate) {
    return res
      .status(400)
      .json({ error: true, message: "All fields are required" });
  }

  const parsedVisitedDate = new Date(parseInt(visitedDate));

  try {
    const pictureBook = await PictureBook.findOne({ _id: id, userId: userId });
    if (!pictureBook) {
      return res
        .status(401)
        .json({ error: false, message: "Picture book not found" });
    }

    const imagePlaceHolder =
      "http://localhost:8000/assets/image-placeholder.jpg";
    pictureBook.title = title;
    pictureBook.story = story;
    pictureBook.visitedLocation = visitedLocation;
    pictureBook.imageURL = imageURL || imagePlaceHolder;
    pictureBook.visitedDate = parsedVisitedDate;

    await pictureBook.save();
    res.status(200).json({ error: false, message: "Updated Successfuly" });
  } catch (error) {
    res.status(400).json({ error: true, message: error.message });
  }
});

// delete a picture book
app.delete("/delete-book/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  try {
    const pictureBook = await PictureBook.findOne({ _id: id, userId: userId });
    if (!pictureBook) {
      return res
        .status(401)
        .json({ error: false, message: "Picture book not found" });
    }

    await pictureBook.deleteOne({ _id: id, userId: userId });

    const imageURL = pictureBook.imageURL;
    const fileName = path.basename(imageURL);
    const filePath = path.join(__dirname, "uploads", fileName);

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Failed to delete the image");
      }
    });
    res.status(200).json({ error: false, message: "Deleted Successfuly" });
  } catch (error) {
    res.status(400).json({ error: true, message: error.message });
  }
});

// update favorite book
app.put("/update-favourite-book/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { isFavourite } = req.body;
  const { userId } = req.user;
  try {
    const pictureBook = await PictureBook.findOne({ _id: id, userId: userId });
    if (!pictureBook) {
      return res
        .status(401)
        .json({ error: false, message: "Picture book not found" });
    }

    pictureBook.isFavourite = isFavourite;

    await pictureBook.save();
    res.status(200).json({
      error: false,
      message: "Updated Successfully",
      books: pictureBook,
    });
  } catch (error) {
    res.status(400).json({ error: true, message: error.message });
  }
});

// get all picture books api
app.get("/get-all-books", authenticateToken, async (req, res) => {
  const { userId } = req.user;
  try {
    const pictureBooks = await PictureBook.find({ userId: userId }).sort({
      isFavourite: -1,
    });
    return res.status(200).json({ books: pictureBooks });
  } catch (error) {
    return res.status(500).json({ error: true, message: error.message });
  }
});

//route for image upload
app.post("/image-upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(401)
        .json({ error: true, message: "No image uploaded" });
    }
    const imageURL = `http://localhost:8000/uploads/${req.file.filename}`;
    return res.status(200).json({ imageURL });
  } catch (error) {
    return res.status(401).json({ error: true, message: error.message });
  }
});

// delete image
app.delete("/delete-image", async (req, res) => {
  const { imageURL } = req.query;

  if (!imageURL) {
    return res
      .status(401)
      .json({ error: true, message: "imageURL parameter id required" });
  }

  try {
    const fileName = path.basename(imageURL);

    const filePath = path.join(__dirname, "uploads", fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res
        .status(200)
        .json({ error: false, message: "Image deleted successfully" });
    } else {
      return res.status(200).json({ error: false, message: "Image not found" });
    }
  } catch (error) {
    return res.status(401).json({ error: true, message: error.message });
  }
});

// serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// search api
app.get("/search", authenticateToken, async (req, res) => {
  const { query } = req.query;
  const { userId } = req.user;
  if (!query) {
    return res.status(401).json({ error: true, message: "query is required" });
  }
  try {
    const searchResult = await PictureBook.find({
      userId: userId,
      $or: [
        { title: { $regex: query, $options: "i" } },
        { story: { $regex: query, $options: "i" } },
        { visitedLocation: { $regex: query, $options: "i" } },
      ],
    }).sort({ isFavourite: -1 });
    res.status(200).json({ stories: searchResult });
  } catch (error) {
    return res.status(401).json({ error: true, message: error.message });
  }
});

// filter books
app.get("/filter-books", authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  const { userId } = req.user;
  const start = new Date(parseInt(startDate));
  const end = new Date(parseInt(endDate));
  try {
    const filterData = await PictureBook.find({
      userId: userId,
      visitedDate: { $gte: start, $lte: end },
    }).sort({ isFavourite: -1 });

    return res.status(200).json({ filteredBooks: filterData });
  } catch (error) {
    return res.status(401).json({ error: true, message: error.message });
  }
});

app.listen("8000");

module.exports = app;
