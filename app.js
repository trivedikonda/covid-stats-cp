const express = require("express");
const app = express();

app.use(express.json());

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, (request, response) => {
      console.log("Server running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//user login api
//API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  //SCENARIO1
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    //successful login of the user
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      //Login Success
      //SCENARIO 3
      const payload = {
        username: username,
      };

      const jwtToken = jwt.sign(payload, "asdfghijklmtesd");
      response.send({ jwtToken });
      //SCENARIO 2
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//token authentication
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghijklmtesd", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        //console.log(payload);
        //request.username = payload.username; //adding the key 'username' to the request object
        next();
      }
    });
  }
};

//API 2
const convertFromSnakeCaseToCamelCase = (eachState) => {
  return {
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
    SELECT * FROM state ORDER BY state_id;`;
  const statesQuery = await db.all(getAllStatesQuery);

  response.send(
    statesQuery.map((eachObject) => convertFromSnakeCaseToCamelCase(eachObject))
  );
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const singleStateQuery = await db.get(getStateQuery);
  response.send(convertFromSnakeCaseToCamelCase(singleStateQuery));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
        INSERT INTO 
            district(district_name,state_id,cases,cured,active,deaths)
        VALUES 
            ('${districtName}',${stateId},${cases},${cured},${active},${deaths}) ;`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
const convertToCamelCase = (districtObj) => {
  return {
    districtId: districtObj.district_id,
    districtName: districtObj.district_name,
    stateId: districtObj.state_id,
    cases: districtObj.cases,
    cured: districtObj.cured,
    active: districtObj.active,
    deaths: districtObj.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictQuery = `SELECT * FROM district 
    WHERE district_id = ${districtId};`;
    const singleDistrictQuery = await db.get(getDistrictQuery);
    response.send(convertToCamelCase(singleDistrictQuery));
    //response.send(singleDistrictQuery);
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);

    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `UPDATE district 
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    ;`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getTotalStats = `SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
    FROM 
        district
    WHERE 
        state_id = ${stateId};`;

    const stats = await db.get(getTotalStats);
    //console.log(stats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
