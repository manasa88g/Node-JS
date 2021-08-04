var format = require("date-fns/format");

const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

const dbPath = path.join(__dirname, "todoApplication.db");
let db = null;

const app = express();
app.use(express.json());

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at 3000");
    });
  } catch (e) {
    console.log("DB Error: ${e.message}");
  }
};

initializeDbAndServer();

// middleware function
const convertDbToResponseObject = (dbObject) => {
  return {
    id: dbObject.id,
    todo: dbObject.todo,
    priority: dbObject.priority,
    status: dbObject.status,
    category: dbObject.category,
    dueDate: dbObject.due_date,
  };
};

const validateQueryParameters = (request, response, next) => {
  const { search_q, priority, category, status, date } = request.query;
  if (
    category !== "WORK" &&
    category !== "HOME" &&
    category !== "LEARNING" &&
    category !== undefined
  ) {
    response.status(400);
    response.send("Invalid Todo Category");
  } else if (
    status !== undefined &&
    status !== "TO DO" &&
    status !== "IN PROGRESS" &&
    status !== "DONE"
  ) {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (
    priority !== undefined &&
    priority !== "HIGH" &&
    priority !== "LOW" &&
    priority !== "MEDIUM"
  ) {
    response.status(400);
    response.send("Invalid Todo Priority");
  } else {
    console.log("next will be executed");
    next();
  }
};

const validateDueDate = (request, response, next) => {
  const { dueDate } = request.body;
  if (dueDate !== undefined) {
    const dateLength = dueDate.split("-").length;
    console.log(dateLength);
    if (dateLength !== 3) {
      response.status(400);
      response.send("Invalid Due Date");
    } else {
      console.log("next will be executed");
      next();
    }
  } else {
    next();
  }
};

const validateBodyParameters = (request, response, next) => {
  const { search_q, priority, category, status } = request.body;

  if (
    category !== "WORK" &&
    category !== "HOME" &&
    category !== "LEARNING" &&
    category !== undefined
  ) {
    response.status(400);
    response.send("Invalid Todo Category");
  } else if (
    status !== "TO DO" &&
    status !== "IN PROGRESS" &&
    status !== "DONE" &&
    status !== undefined
  ) {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (
    priority !== "HIGH" &&
    priority !== "LOW" &&
    priority !== "MEDIUM" &&
    priority !== undefined
  ) {
    response.status(400);
    response.send("Invalid Todo Priority");
  } else {
    next();
  }
};

// get todo API

app.get("/todos/", validateQueryParameters, async (request, response) => {
  const { search_q, priority, category, status, date } = request.query;
  console.log(request.query);
  let getToDoQuery;
  if (
    category !== undefined &&
    priority !== undefined &&
    status !== undefined
  ) {
    getTodoQuery = `SELECT * FROM todo 
      WHERE category = '${category}' and status = '${status}' and priority ='${priority}';`;
  } else if (category !== undefined && priority !== undefined) {
    getTodoQuery = `SELECT * FROM todo 
      WHERE category = '${category}' and priority ='${priority}';`;
  } else if (priority !== undefined && status !== undefined) {
    getTodoQuery = `SELECT * FROM todo 
      WHERE status = '${status}' and priority ='${priority}';`;
  } else if (category !== undefined && status !== undefined) {
    getTodoQuery = `SELECT * FROM todo 
      WHERE category = '${category}' and status = '${status}';`;
  } else if (category !== undefined) {
    getTodoQuery = `SELECT * FROM todo 
      WHERE category = '${category}' ;`;
  } else if (priority !== undefined) {
    getTodoQuery = `SELECT * FROM todo 
      WHERE priority ='${priority}';`;
  } else if (status !== undefined) {
    getTodoQuery = `SELECT * FROM todo 
      WHERE status = '${status}' ;`;
  } else if (search_q !== undefined) {
    getTodoQuery = `SELECT * FROM todo 
      WHERE todo LIKE '%${search_q}%';`;
  }

  const todoList = await db.all(getTodoQuery);
  response.send(
    todoList.map((eachTodo) => convertDbToResponseObject(eachTodo))
  );
});

// get a todo based on id API

app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getTodoQuery = `
    SELECT * FROM todo WHERE id = ${todoId};`;
  const todo = await db.get(getTodoQuery);
  response.send(convertDbToResponseObject(todo));
});

//get todo based on due date API

app.get("/agenda/", async (request, response) => {
  const { date } = request.query;
  if (date === undefined) {
    response.status(400);
    response.send("Invalid Due Date");
  } else {
    const dateArray = date.split("-");
    const dateLength = dateArray.length;
    console.log(dateLength);
    if (
      dateLength !== 3 ||
      dateArray[0].length !== 4 ||
      dateArray[1].length > 2 ||
      dateArray[1].length < 1 ||
      dateArray[2].length > 2 ||
      dateArray[2].length < 1
    ) {
      response.status(400);
      response.send("Invalid Due Date");
    } else {
      const formattedDate = format(new Date(date), "yyyy-MM-dd");
      console.log(formattedDate);

      const getTodoQuery = `
    SELECT * FROM todo WHERE due_date = '${formattedDate}';`;

      const todoList = await db.all(getTodoQuery);

      response.send(
        todoList.map((eachTodo) => convertDbToResponseObject(eachTodo))
      );
    }
  }
});

// create TO DO API

app.post(
  "/todos/",
  validateBodyParameters,
  validateDueDate,
  async (request, response) => {
    const { id, todo, priority, status, category, dueDate } = request.body;

    const formattedDate = format(new Date(dueDate), "yyyy-MM-dd");
    console.log(formattedDate);
    const createTodoQuery = `
  INSERT INTO todo (id,todo,category, priority,status,due_date)
  VALUES(${id}, '${todo}','${category}','${priority}','${status}','${formattedDate}');`;
    const dbResponse = await db.run(createTodoQuery);
    console.log(dbResponse);
    response.send("Todo Successfully Added");
  }
);

// update todo API

app.put(
  "/todos/:todoId/",
  validateBodyParameters,
  validateDueDate,
  async (request, response) => {
    const { todoId } = request.params;
    const { status, priority, category, dueDate, todo } = request.body;
    let updateTodoQuery;
    if (status !== undefined) {
      updateTodoQuery = `
        UPDATE todo
        SET status = '${status}'
        WHERE id = ${todoId};`;
      await db.run(updateTodoQuery);
      response.send("Status Updated");
    } else if (priority !== undefined) {
      updateTodoQuery = `
        UPDATE todo
        SET priority = '${priority}'
        WHERE id = ${todoId};`;
      await db.run(updateTodoQuery);
      response.send("Priority Updated");
    } else if (category !== undefined) {
      updateTodoQuery = `
        UPDATE todo
        SET category = '${category}'
        WHERE id = ${todoId};`;
      await db.run(updateTodoQuery);
      response.send("Category Updated");
    } else if (dueDate !== undefined) {
      const formattedDate = format(new Date(dueDate), "yyyy-MM-dd");
      updateTodoQuery = `
        UPDATE todo
        SET due_date = '${formattedDate}'
        WHERE id = ${todoId};`;
      await db.run(updateTodoQuery);
      response.send("Due Date Updated");
    } else if (todo !== undefined) {
      updateTodoQuery = `
        UPDATE todo
        SET todo = '${todo}'
        WHERE id = ${todoId};`;
      await db.run(updateTodoQuery);
      response.send("Todo Updated");
    }
  }
);

// DELETE API

app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodoQuery = `DELETE FROM todo WHERE id = ${todoId};`;
  await db.run(deleteTodoQuery);
  response.send("Todo Deleted");
});

module.exports = app;
