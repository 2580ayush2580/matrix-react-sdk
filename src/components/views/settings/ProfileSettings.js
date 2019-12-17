/*
Copyright 2019 New Vector Ltd

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

import React, {createRef} from 'react';
import {_t} from "../../../languageHandler";
import MatrixClientPeg from "../../../MatrixClientPeg";
import Field from "../elements/Field";
import {User} from "matrix-js-sdk";
import { getHostingLink } from '../../../utils/HostingLink';
import sdk from "../../../index";

export default class ProfileSettings extends React.Component {
    constructor() {
        super();

        const client = MatrixClientPeg.get();
        this.state = {
            userId: user.userId,
            originalDisplayName: undefined,
            displayName: undefined,
            originalAvatarUrl: undefined,
            avatarUrl: undefined,
            avatarFile: null,
            enableProfileSave: false,
        };

        // We want to fetch the user's real profile each time so we don't render
        // stale or per-room profiles by mistake.
        client.getProfileInfo(client.getUserId()).then((user) => ({
            let avatarUrl = user.avatarUrl;
            if (avatarUrl) avatarUrl = client.mxcUrlToHttp(avatarUrl, 96, 96, 'crop', false);
            let displayName = user.displayname;
            this.setState({
                displayName: user.displayname,
                originalDisplayName: user.displayname,
                originalAvatarUrl: avatarUrl,
                avatarUrl: avatarUrl,
            });
        }).catch((e) => {
            console.warn("User profile could not be fetched:", e);
        });

        this._avatarUpload = createRef();
    }

    _uploadAvatar = () => {
        this._avatarUpload.current.click();
    };

    _removeAvatar = () => {
        // clear file upload field so same file can be selected
        this._avatarUpload.current.value = "";
        this.setState({
            avatarUrl: undefined,
            avatarFile: undefined,
            enableProfileSave: true,
        });
    };

    _saveProfile = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({enableProfileSave: false});

        const client = MatrixClientPeg.get();
        const newState = {};

        // TODO: What do we do about errors?

        if (this.state.originalDisplayName !== this.state.displayName) {
            await client.setDisplayName(this.state.displayName);
            newState.originalDisplayName = this.state.displayName;
        }

        if (this.state.avatarFile) {
            const uri = await client.uploadContent(this.state.avatarFile);
            await client.setAvatarUrl(uri);
            newState.avatarUrl = client.mxcUrlToHttp(uri, 96, 96, 'crop', false);
            newState.originalAvatarUrl = newState.avatarUrl;
            newState.avatarFile = null;
        }

        this.setState(newState);
    };

    _onDisplayNameChanged = (e) => {
        this.setState({
            displayName: e.target.value,
            enableProfileSave: true,
        });
    };

    _onAvatarChanged = (e) => {
        if (!e.target.files || !e.target.files.length) {
            this.setState({
                avatarUrl: this.state.originalAvatarUrl,
                avatarFile: null,
                enableProfileSave: false,
            });
            return;
        }

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.setState({
                avatarUrl: ev.target.result,
                avatarFile: file,
                enableProfileSave: true,
            });
        };
        reader.readAsDataURL(file);
    };

    render() {
        const hostingSignupLink = getHostingLink('user-settings');
        let hostingSignup = null;
        if (hostingSignupLink) {
            hostingSignup = <span className="mx_ProfileSettings_hostingSignup">
                {_t(
                    "<a>Upgrade</a> to your own domain", {},
                    {
                        a: sub => <a href={hostingSignupLink} target="_blank" rel="noopener">{sub}</a>,
                    },
                )}
                <a href={hostingSignupLink} target="_blank" rel="noopener">
                    <img src={require("../../../../res/img/external-link.svg")} width="11" height="10" alt='' />
                </a>
            </span>;
        }

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const AvatarSetting = sdk.getComponent('settings.AvatarSetting');
        return (
            <form onSubmit={this._saveProfile} autoComplete="off" noValidate={true}>
                <input type="file" ref={this._avatarUpload} className="mx_ProfileSettings_avatarUpload"
                       onChange={this._onAvatarChanged} accept="image/*" />
                <div className="mx_ProfileSettings_profile">
                    <div className="mx_ProfileSettings_controls">
                        <p>
                            {this.state.userId}
                            {hostingSignup}
                        </p>
                        <Field id="profileDisplayName" label={_t("Display Name")}
                               type="text" value={this.state.displayName} autoComplete="off"
                               onChange={this._onDisplayNameChanged} />
                    </div>
                    <AvatarSetting
                        avatarUrl={this.state.avatarUrl}
                        avatarName={this.state.displayName || this.state.userId}
                        avatarAltText={_t("Profile picture")}
                        uploadAvatar={this._uploadAvatar}
                        removeAvatar={this._removeAvatar} />
                </div>
                <AccessibleButton onClick={this._saveProfile} kind="primary"
                                  disabled={!this.state.enableProfileSave}>
                    {_t("Save")}
                </AccessibleButton>
            </form>
        );
    }
}
