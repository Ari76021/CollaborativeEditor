import React from 'react';
import Avatar from 'react-avatar'

function Client({username}) {
    return (
        <div className="d-flex align-items-center">
            <Avatar name={username.toString()} size={50} round="14px" className="mr-3 mt-1">
            </Avatar>
            <span className="mx-2">{username.toString()}</span>
        </div>
    );
}

export default Client;