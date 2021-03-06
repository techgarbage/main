import React, { useState, useEffect, Component } from 'react';
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tooltip,
  Spinner,
} from 'reactstrap';
import { Link } from 'react-router-dom';
import bookmark_icon from '../../../style/inc/bookmark.svg';
import share_icon from '../../../style/inc/share.svg';
import { fetchTask } from '../../../actions/taskAction';
import { connect } from 'react-redux';
import moment from 'moment';
import TLoader from '../../utils/TLoader';

const TaskDetails = (props) => {
  const { modal, toggle } = props;

  const [task, setTask] = useState({});

  useEffect(() => {}, [task]);
  const handleChange = (newTask) => {
    setTask(newTask);
  };
  const modalOpened = () => {
    props.fetchTask(props.selected_task).then((payload) => {
      handleChange(payload.taskData[0]);
    });
  };

  const skillsbadges2 = (skills) => {
    if (skills) {
      let fsix = skills;

      return fsix.map((skl, i) => (
        <div className='profile-skills dt-skills' key={i}>
          {skl}
        </div>
      ));
    }
  };

  const skillSection = (
    <div className='profile-badge-categories'>{skillsbadges2(task.skills)}</div>
  );

  const modalClosed = () => {
    setTask({});
  };

  const checkIfAlreadyApplied = () => {
    if (task._id && props.pending_proposals.length) {
      for (let k in props.pending_proposals) {
        if (props.pending_proposals[k].applied_tasks[0]._id === task._id)
          return true;
      }
    }
    return false;
  };

  const onShareIconClick = () => {
    props.onTaskShare({
      from: `${task.userdetails[0].first_name} ${task.userdetails[0].second_name}`,
      task_url: `https://www.taskbarter.com/t/${task._id}`,
      task_headline: task.headline,
      task_category: task.category,
    });
  };

  if (!task.headline) {
    return (
      <Modal
        isOpen={modal}
        toggle={toggle}
        onOpened={modalOpened}
        onClosed={modalClosed}
        className='dt-modal dt-loading fade-scale'
      >
        <ModalBody className='dt-body loading'>
          <TLoader colored={true} />
        </ModalBody>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={modal}
      toggle={toggle}
      onOpened={modalOpened}
      onClosed={modalClosed}
      className='dt-modal fade-scale'
    >
      <ModalHeader toggle={toggle} className='dt-header'>
        <a
          href={'/t/' + task._id}
          style={{ textDecoration: 'none' }}
          target='_blank'
          className='dt-title-anchor'
        >
          <div className='dt-sub-title'>I want someone to</div>
          <div className='dt-title'>{task.headline} </div>
        </a>
        <div className='dt-added-on'>
          Posted <span className='dt-date'>{moment(task.date).fromNow()}</span>{' '}
          • {task.totalApplicants} applicants
        </div>
      </ModalHeader>
      <div className='dt-action-box'>
        <div className='feed-card--footer'>
          <div className='feed-card--footer-left '>
            {' '}
            <img
              src={bookmark_icon}
              className='svg_icon icon_inactive'
              id='SaveJob'
            ></img>
            &nbsp;&nbsp;&nbsp;
            <img
              src={share_icon}
              className='svg_icon icon_inactive'
              id='share-job'
              onClick={onShareIconClick}
            ></img>
          </div>
          <div className='feed-card--footer-right '>
            {props.current_user === task.user ? (
              <Link style={{ textDecoration: 'none' }} to={`/t/${task._id}`}>
                <button className='feed-card-learn-more dt-action-btn'>
                  View Your Task
                </button>
              </Link>
            ) : (
              <React.Fragment>
                {checkIfAlreadyApplied() ? (
                  <span style={{ fontSize: '14px' }}>Proposal Sent</span>
                ) : (
                  <button
                    onClick={props.proposal_toggle}
                    className='feed-card-learn-more dt-action-btn'
                    disabled={checkIfAlreadyApplied()}
                  >
                    Send Proposal
                  </button>
                )}
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
      <ModalBody className='dt-body'>
        <div className='task-list-title dt-title'>Reward</div>
        <div className='mb-3'>
          You will earn{' '}
          <span className='dt-points'>{task.taskpoints} points</span>
        </div>
        <div className='task-list-title dt-title'>Category</div>
        <div className='mb-3'>{task.category}</div>
        <div className='task-list-title dt-title mb-1'>Skills</div>
        <div className='mb-3 mt-1'>{skillSection}</div>
        <div className='task-list-title dt-title mb-2'>Description</div>
        <div className='mb-4 mt-1 ql-editor dt-description'>
          <div
            dangerouslySetInnerHTML={{
              __html: task.description,
            }}
          ></div>
        </div>
        <div className='task-list-title dt-title'>Posted By</div>
        {task.userdetails && task.userdetails[0] ? (
          <div className='mb-3'>
            <span className='dt-points'>
              {task.userdetails[0].first_name} {task.userdetails[0].second_name}
            </span>
            <div className='dt-added-on'>
              Member since{' '}
              <span className='dt-date'>
                {moment(task.userdetails[0].memberSince).years()}
              </span>{' '}
              • {task.userdetails[0].location}
            </div>
          </div>
        ) : (
          <div className='mb-2'>Hidden</div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default connect(null, {
  fetchTask,
})(TaskDetails);
