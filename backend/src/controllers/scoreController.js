'use strict';

const scoreService = require('../services/scoreService');

async function list(req, res, next) {
  try {
    const result = await scoreService.listScores(req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const score = await scoreService.addScore(req.user.id, req.body);
    res.status(201).json(score);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const score = await scoreService.editScore(req.user.id, req.params.id, req.body);
    res.status(200).json(score);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await scoreService.deleteScore(req.user.id, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
