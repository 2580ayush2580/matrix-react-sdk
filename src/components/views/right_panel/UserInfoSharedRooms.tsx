/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import Spinner from "../elements/Spinner";
import RoomTile from "../rooms/RoomTile";
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import Pill from '../../views/elements/Pill';
import AccessibleButton from '../../views/elements/AccessibleButton';
import SpecPermalinkConstructor from '../../../utils/permalinks/SpecPermalinkConstructor';
import { mostRecentActivityFirst } from '../../../RoomListSorter';

interface IProps {
    userId: string;
    compact: boolean;
}

interface IState {
    roomIds?: [];
    error: boolean;
    showAll: boolean;
}

const LIMITED_VIEW_SHOW_COUNT = 3;

export default class UserInfoSharedRooms extends React.PureComponent<IProps, IState> {

    constructor(props: IProps) {
        super(props);

        this.state = {
            error: false,
            showAll: false,
        };
    }

    async componentDidMount() {
        try {
            const roomIds = await MatrixClientPeg.get()._unstable_getSharedRooms(this.props.userId);
            this.setState({roomIds});
        } catch (ex) {
            console.log(`Failed to get shared rooms for ${this.props.userId}`, ex);
            this.setState({ error: true });
        }
    }

    private onRoomTileClick(roomId) {
        dis.dispatch({
            action: 'view_room',
            show_room_tile: true, // to make sure the room gets scrolled into view
            room_id: roomId,
        });
    }

    private onShowMoreClick() {
        console.log("Showing more");
        this.setState({
            showAll: true,
        });
    }

    private renderRoomTile(room) {
        // If the room cannot be found, hide it.
        if (!room) {
            return null;
        }

        // If the room has been upgraded, hide it.
        const tombstone = room.currentState.getStateEvents("m.room.tombstone", "");
        if (tombstone) {
            return null;
        }

        if (this.props.compact) {
            // XXX: This is inefficent as we only render COMPACT_VIEW_SHOW_COUNT rooms at a time, the other pills are wasted.
            const alias = room.getCanonicalAlias();
            if (!alias) {
                // Without an alias we get ugly room_ids, hide it.
                return null;
            }
            return <a href={`#/room/${alias}`}><Pill
                key={room.roomId}
                type={Pill.TYPE_ROOM_MENTION}
                room={room}
                url={new SpecPermalinkConstructor().forRoom(alias)}
                inMessage={false}
                shouldShowPillAvatar={true}
                isSelected={false}
            /></a>;
        }

        return <li key={room.roomId}>
            <RoomTile
                onClick={this.onRoomTileClick.bind(undefined, [room.roomId])}
                room={room}
                collapsed={false}
                unread={false}
                highlight={false}
                transparent={true}
                isInvite={false}
                incomingCall={false}
            />
        </li>;
    }

    private renderRoomTiles() {
        const peg = MatrixClientPeg.get();
        const orderedActiveRooms = mostRecentActivityFirst(this.state.roomIds.map(
            (roomId) => peg.getRoom(roomId)
        ));

        // We must remove the null values in order for the slice to work in render()
        return orderedActiveRooms.map((room) => this.renderRoomTile(room)).filter((tile => tile !== null));
    }

    render(): React.ReactNode {
        let content;
        let realCount = 0;

        if (this.state.roomIds && this.state.roomIds.length > 0) {
            content = this.renderRoomTiles();
            realCount = content.length;
            if (!this.state.showAll) {
                content = content.slice(0, LIMITED_VIEW_SHOW_COUNT);
            }
        } else if (this.state.roomIds) {
            content = <p> {_t("You share no rooms in common with this user.")} </p>;
        } else if (this.state.error) {
            content = <p> {_t("There was an error fetching shared rooms with this user.")} </p>;
        } else {
            // We're still loading
            content = <Spinner/>;
        }

        // Compact view: Show as a single line.
        if (this.props.compact && content.length) {
            if (realCount <= content.length) {
                return <p> {_t("You are both participating in <rooms></rooms>", {}, {rooms: content})} </p>;
            } else {
                return <p> {_t("You are both participating in <rooms></rooms> and %(hidden)s more", {
                    hidden: realCount - content.length,
                }, {
                    rooms: content
                })}</p>;
            }
        } else if (this.props.compact) {
            return content;
        }

        const canShowMore = !this.state.showAll && realCount > LIMITED_VIEW_SHOW_COUNT;
        // Normal view: Show as a list with a header
        return <div className="mx_UserInfoSharedRooms mx_UserInfo_container">
            <h3>{ _t("Shared Rooms") }</h3>
            <ul>
                {content}
            </ul>
            { canShowMore && <AccessibleButton className="mx_UserInfo_field" onClick={() => this.onShowMoreClick()}>
                { _t("Show %(count)s more", { count: realCount - content.length}) }
                </AccessibleButton> }
        </div>;
    }
}