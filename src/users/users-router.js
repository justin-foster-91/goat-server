const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/jwt-auth');
const UsersService = require('./users-service');

const usersRouter = express.Router();
const parseBody = express.json();

usersRouter
  .route('/')
  .post(parseBody, (req, res, next) => {
    const {password, username, name} = req.body;

    for (const field of ['name', 'username', 'password']) {
      if (!req.body[field]) {
        return res.status(400).json({message: `Missing '${field}' in request body`});
      }
    }
    
    if (username.startsWith(' ') || username.endsWith(' ')) {
      return res.status(400).json({message: 'Username cannot start or end with spaces'});
    }

    const passwordError = UsersService.validatePassword(password);
    if (passwordError !== null) {
      return res.status(400).json({message: passwordError});
    }

    UsersService.hasUserWithUsername(req.app.get('db'), username)
      .then(hasUserWithUsername => {
        if (hasUserWithUsername === true) {
          return res.status(400).json({message:'Username already taken'});
        } else {
          return UsersService.hashPassword(password)
            .then(hashedPassword => {
              const newUser = {
                username,
                password: hashedPassword,
                name,
              };
              return UsersService.insertUser(req.app.get('db'), newUser)
                .then(user => {
                  res.status(201)
                    .location(path.posix.join(req.originalUrl, `/${user.id}`))
                    .json(UsersService.serializeUser(user));
                });
            });
        }
      })
      .catch(next);
  })
  .patch(requireAuth, parseBody, (req, res, next) => {
    const {modify_points, point_goal} = req.body;
    if(isNaN(modify_points) && isNaN(point_goal)) {
      return res.status(400).json({message: 'Body must contain number modify_points or number point_goal'});
    }
    const newData = {};
    if(point_goal) {
      newData.point_goal = point_goal;
    }
    if(modify_points) {
      UsersService.getPoints(req.app.get('db'), req.user.id)
        .then(user => {
          let currPoints = user.points;
          currPoints = Math.min(Math.max(currPoints + modify_points, 0), 100);
          newData.points = currPoints;
          UsersService.updateUser(req.app.get('db'), req.user.id, newData)
            .then(() => {
              return res.status(202).json(newData);
            })
            .catch(next);
        });
    }
    else {
      UsersService.updateUser(req.app.get('db'), req.user.id, newData)
        .then(() => {
          return res.status(202).json(newData);
        })
        .catch(next);
    }
  })
  .get(requireAuth, (req, res, next) => {
    UsersService.getPoints(req.app.get('db'), req.user.id)
      .then(data => {
        return res.status(200).json(data);
      })
      .catch(next);
  });

usersRouter
  .get('/:user_id', (req, res, next) => {
    const user_id = req.params.user_id;
    UsersService.getUsername(req.app.get('db'), user_id)
      .then(user => {
        if (!user) {
          return res.status(400).json({message: 'User not found'});
        }
        return res.status(200).json(user.user_name);
      })
      .catch(next);
  });



module.exports = usersRouter;
