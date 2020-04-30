const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const Task = require('../../models/Task');
const User = require('../../models/User');
const Proposal = require('../../models/Proposal');
const Work = require('../../models/Work');
const Conversation = require('../../models/Conversation');
const PersonalDetails = require('../../models/PersonalDetails');
const { check, validationResult } = require('express-validator');
const { MESSAGETYPE_PROPOSAL } = require('../../constants/types');
const {
  PROPOSAL_ACCEPTED,
  PROPOSAL_REJECTED,
  TASK_PENDING,
  TASK_ASSIGNED,
} = require('../../constants/state');
const mongoose = require('mongoose');
const { addNotification } = require('../../functions/notifications');

// @route POST api/tasks/add
// @desc Add new Task
// @access Private

// only those having account must add task to ensure security ?
router.post('/add', auth, async (req, res) => {
  if (!req.body.headline) {
    return res
      .status(404)
      .json({ headlineNotFound: 'Headline cannot be empty!' });
  }

  const profile = await PersonalDetails.findOne({
    user: req.user.id,
  });

  const currentPoints = profile.pointsEarned - profile.pointsSpent;

  if (currentPoints < req.body.points) {
    return res.status(500).send('Insufficient balance.');
  }

  profile.pointsSpent =
    parseInt(profile.pointsSpent) + parseInt(req.body.points);

  profile.tasksPosted = parseInt(profile.tasksPosted) + 1;

  await profile.save();

  const newTask = new Task({
    headline: req.body.headline,
    description: req.body.description,
    category: req.body.category,
    skills: req.body.skills,
    user: req.user.id, // for secure task adding
    duration: req.body.duration,
    taskpoints: req.body.points,
  });
  newTask
    .save()
    .then((task) => {
      addNotification(
        `Your task '${task.headline}' is now live for public.`,
        profile.user,
        `/t/${task._id}`
      );

      return res.json(task);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).send('Server Error');
    });
});

// @route   GET api/tasks/explore
// @desc    Get all tasks with filtering, sorting and lazy loading
// @access  Public         // login to see tasks

/*
@VARIABLES:
s='' (search query)
k='' (skill filter)
i='' (industry filter)
r='' (sort by filter)
l='' (location filter)
c=0 (current segment for lazy loading)
z=0 (segment size)
*/

router.get('/explore', async (req, res) => {
  try {
    const search_query = (req.query.s && req.query.s.toString()) || '';
    const skill_filter = (req.query.k && req.query.k.toString()) || '';
    const industry_filter = (req.query.i && req.query.i.toString()) || '';
    const location_filter = (req.query.l && req.query.l.toString()) || '';
    const sort_by = (req.query.r && req.query.r.toString()) || '';
    const segment_number = parseInt(req.query.c) || 0;
    const segment_size = parseInt(req.query.z) || 6;

    let search_filter = {};
    if (search_query) {
      search_filter = {
        $or: [
          {
            description: new RegExp('\\b' + search_query + '', 'i'),
          },
          {
            headline: new RegExp('\\b' + search_query + '', 'i'),
          },
        ],
      };
    }
    const tasks = await Task.aggregate([
      {
        $match: {
          $and: [
            search_filter,
            { $or: [{ state: null }, { state: TASK_PENDING }] },
          ],
        },
      },
      {
        $lookup: {
          from: 'personaldetails',
          localField: 'user',
          foreignField: 'user',
          as: 'userdetails',
        },
      },
      {
        $sort: { date: -1 },
      },
      {
        $skip: segment_size * segment_number,
      },
      {
        $limit: segment_size,
      },
      {
        $project: {
          headline: 1,
          category: 1,
          taskpoints: 1,
          date: 1,
          skills: 1,
          userdetails: { first_name: 1, second_name: 1, location: 1 },
        },
      },
    ]);
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/tasks/fetch
// @desc    Get single task using ID
// @access  Public         // login to see tasks

router.get('/fetch', async (req, res) => {
  try {
    const task_id = req.query.id || '';
    if (task_id === '') {
      throw { msg: 'no id provided' };
    }

    const taskData = await Task.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId(task_id) },
      },
      {
        $lookup: {
          from: 'personaldetails',
          localField: 'user',
          foreignField: 'user',
          as: 'userdetails',
        },
      },
      {
        $lookup: {
          from: 'works',
          localField: '_id',
          foreignField: 'task',
          as: 'workdetails',
        },
      },
    ]);
    res.json({ taskData });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/tasks/:task_id
// @desc    Delete task
// @access  Private
router.delete('/:task_id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.task_id);

    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authourized' });
    }

    await Task.findOneAndRemove({ _id: req.params.task_id });

    res.json({ msg: 'Task deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
// @route   GET api/tasks
// @desc    Get all tasks
// @access  Public         // login to see tasks

router.get('/:limit_tasks/:skip_tasks', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit_tasks) || 0;
    const skip = parseInt(req.params.skip_tasks) || 0;
    const tasks = await Task.find().sort({ date: -1 }).limit(limit).skip(skip); // toget recents one
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/tasks
// @desc    Get all tasks count
// @access  Public         // login to see tasks

router.get('/taskscount', async (req, res) => {
  try {
    const tasks = await Task.count(); // toget recents one
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/tasks/all/:user_id/:skip/:limit
// @desc    get all tasks of some specific user. Skip and Limit are for pagination.
// @access  Public
router.get('/all/:user_id/:skip_tasks/:limit_tasks', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit_tasks) || 0;
    const skip = parseInt(req.params.skip_tasks) || 0;

    const uTask = await Task.find({
      user_id: req.params.user_id,
    })
      .limit(limit)
      .skip(skip);

    if (!uTask) {
      return res.status(200).json({ msg: 'No tasks found' });
    }
    res.json(uTask);
  } catch (err) {
    if (err.kind == 'ObjectId') {
      return res
        .status(400)
        .json({ msg: 'Could not find tasks for this user.' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/tasks/like/:id
// @desc    Like task
// @access  Private         // login to see tasks

router.put('/like/:task_id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.task_id);
    // check for already liked
    if (
      task.likes.filter((like) => like.user.toString() === req.user.id).length >
      0
    ) {
      //Get remove index

      const removeIndex = task.likes
        .map((like) => like.user.toString())
        .indexOf(req.user.id);

      task.likes.splice(removeIndex, 1);
      await task.save();

      res.json(task.likes);

      // return res.status(400).json({ msg: 'task already liked' });
    } else {
      task.likes.unshift({ user: req.user.id });
      await task.save();

      res.json(task.likes);
    }

    //res.json(posts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
// @route   POST api/tasks/proposal/:task_id
// @desc    Proposal on a task
// @access  Private
router.post(
  '/proposal/:task_id',
  [auth, [check('text', 'Text is required').not().isEmpty()]],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user.id).select('-password');
      const task = await Task.findById(req.params.task_id);

      const newProposal = {
        text: req.body.text,
        name: user.name,
        avatar: user.avatar,
        user: req.user.id,
      };

      task.proposals.unshift(newProposal);

      await task.save();

      res.json(task.proposals);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error .');
    }
  }
);

// @route   DELETE api/tasks/proposal/:task_id/:proposal_id
// @desc    Delete Proposal
// @access  Private

router.delete('/proposal/:task_id/:proposal_id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.task_id);

    // Pull out proposal

    const proposal = task.proposals.find(
      (proposal) => proposal.id === req.params.proposal_id // what about string compare?
    );

    // make sure proposal exists

    //return res.json(task.proposals);

    if (!proposal) {
      return res.status(404).json({ msg: 'proposal does not exist' });
    }

    // check for same user who had proposal written

    if (proposal.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authourized' });
    }

    //Get remove index

    const removeIndex = task.proposals
      .map((proposal) => proposal.id.toString())
      .indexOf(req.params.proposal_id);

    task.proposals.splice(removeIndex, 1);
    await task.save();

    res.json(task.proposals);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route POST api/tasks/sendproposal
// @desc Send new Task
// @access Private

router.post('/sendproposal', auth, async (req, res) => {
  try {
    const newProposal = new Proposal({
      task: req.body.task_id,
      text: req.body.text,
      user: req.user.id,
    });
    const prop = await newProposal.save();
    const ptask = await Task.findById(req.body.task_id);
    if (ptask.user.toString() === req.user.id.toString()) {
      return res
        .status(500)
        .json({ message: 'you cannot apply to your own task.' });
    }
    let conv = await Conversation.findOne({
      $or: [
        {
          user1: req.user.id,
          user2: ptask.user,
        },
        {
          user1: ptask.user,
          user2: req.user.id,
        },
      ],
    });
    if (!conv) {
      const newConversation = new Conversation({
        user1: req.user.id,
        user2: ptask.user,
      });
      conv = await newConversation.save();
    }
    const payload = {
      task_id: req.body.task_id,
      proposal_id: prop.id,

      //need to store this beforehand because user can update it in future.
      task_headline: ptask.headline,
      task_points: ptask.taskpoints,
    };
    const newMsg = new Message({
      conversation_id: conv._id,
      sender: req.user.id,
      text: req.body.text,
      content_type: MESSAGETYPE_PROPOSAL,
      content_payload: JSON.stringify(payload),
    });
    const completed = await newMsg.save();

    let prof = await PersonalDetails.findOne({
      user: req.user.id,
    });

    addNotification(
      `You received a proposal from ${prof.first_name} ${prof.second_name} for your task '${ptask.headline}'.`,
      ptask.user,
      `/t/${ptask._id}`
    );

    res.json(prop);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/tasks/proposals
// @desc    Get all proposals of task
// @access  Private

router.get('/proposals/', async (req, res) => {
  try {
    const task_id = req.query.id || '';
    if (task_id === '') {
      throw { msg: 'no id provided' };
    }
    const proposal_data = await Proposal.aggregate([
      {
        $match: { task: mongoose.Types.ObjectId(task_id) },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $lookup: {
          from: 'personaldetails',
          localField: 'user',
          foreignField: 'user',
          as: 'userdetails',
        },
      },
    ]);
    res.json({ proposal_data });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/tasks/proposal_state
// @desc    Change proposal state. Accept or Reject.
// @access  Private

router.post(
  '/proposal_state',
  [auth, [check('new_state', 'You must send new state.').not().isEmpty()]],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const pros = await Proposal.findById(req.body.proposal_id);
      pros.status = req.body.new_state;

      const pTask = await Task.findById(pros.task);

      if (pros.status === PROPOSAL_ACCEPTED) {
        //once proposal is accepted:

        pTask.state = TASK_ASSIGNED;
        await pTask.save();

        const newWork = new Work({
          assignedTo: pros.user,
          task: pros.task,
          assignee: req.user.id,
        });

        const tempWork = await newWork.save();

        addNotification(
          `Congrats, your proposal for the task '${pTask.headline}' has been accepted. Start working now!`,
          pros.user,
          `/w/${tempWork._id}`
        );
        addNotification(
          `Work for the task '${pTask.headline}' is on its way.`,
          req.user.id,
          `/w/${tempWork._id}`
        );
      }

      if (pros.status === PROPOSAL_REJECTED) {
        addNotification(
          `Your proposal for the task '${pTask.headline}' was rejected by the task owner.`,
          pros.user,
          `/t/${pTask._id}`
        );
      }

      await pros.save();
      res.json(pros);
    } catch (err) {
      console.error(err.message);

      res.status(500).send('Server Error .');
    }
  }
);

// @route   GET api/tasks/published
// @desc    Get all published tasks by the user
// @access  Private

router.get('/published/', [auth], async (req, res) => {
  try {
    const limit = parseInt(req.query.lim) || -1;
    const tasks_data = await Task.aggregate([
      {
        $match: { user: mongoose.Types.ObjectId(req.user.id) },
      },
      {
        $sort: { updatedAt: -1 },
      },
      {
        $limit: limit,
      },
    ]);
    res.json({ tasks_data });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/tasks/working
// @desc    Get all tasks the user is working on
// @access  Private

router.get('/working/', [auth], async (req, res) => {
  try {
    const limit = parseInt(req.query.lim) || -1;
    const work_data = await Work.aggregate([
      {
        $match: { assignedTo: mongoose.Types.ObjectId(req.user.id) },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'task',
          foreignField: '_id',
          as: 'taskDetails',
        },
      },
      {
        $sort: { updatedAt: -1 },
      },
      {
        $limit: limit,
      },
    ]);
    res.json({ work_data });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
