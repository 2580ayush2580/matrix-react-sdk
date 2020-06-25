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

import React, {useRef, useState, useContext} from "react";
import classNames from "classnames";
import {MatrixClient} from "matrix-js-sdk/src/client";

import SettingsSection from "../SettingsSection";
import {_t} from "../../../../languageHandler";
import StyledCheckbox from "../../elements/StyledCheckbox";
import AccessibleButton from "../../elements/AccessibleButton";
import {Key} from "../../../../Keyboard";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import Modal from "../../../../Modal";
import ErrorDialog from "../../dialogs/ErrorDialog";
import {ContentRules, IContentRules} from "../../../../notifications/ContentRules";


interface IProps {
    disabled?: boolean;
    contentRules: IContentRules;
    keywordsEnabled: boolean;
    soundEnabled: boolean;
    setKeywordsEnabled(enabled: boolean);
}

interface IKeywordsEditorProps {
    disabled?: boolean;
    initialKeywords: string[];
    addKeyword(keyword: string);
    removeKeyword(keyword: string);
}

interface KeywordPill {
    disabled?: boolean;
    keyword: string;
    onRemove(keyword: string);
}

const KeywordPill: React.FC<KeywordPill> = ({disabled, keyword, onRemove}) => {
    const onClick = e => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        onRemove(keyword);
    };

    let removeButton;
    if (!disabled) {
        removeButton = <AccessibleButton className="mx_NotificationsTab_mentionsKeywords_removePill" onClick={onClick}>
            <img src={require("../../../../../res/img/icon-pill-remove.svg")} alt={_t("Remove")} width={8} height={8} />
        </AccessibleButton>;
    }

    return (
        <span className="mx_NotificationsTab_mentionsKeywords_keywordPill">
            <span>{keyword}</span>
            {removeButton}
        </span>
    );
};

const KeywordsEditor: React.FC<IKeywordsEditorProps> = ({disabled, initialKeywords, addKeyword, removeKeyword}) => {
    const ref = useRef<HTMLTextAreaElement>();
    const [value, setValue] = useState("");

    // locally manage keywords state so we don't have to deal with finnicky ordering
    const [keywords, setKeywords] = useState<string[]>(initialKeywords);

    const _addKeyword = keyword => {
        keyword = keyword.trim();
        if (!keyword || keywords.includes(keyword)) return;
        setKeywords([...keywords, keyword]);
        addKeyword(keyword);
    };
    const _removeKeyword = keyword => {
        setKeywords(keywords.filter(k => k !== keyword));
        removeKeyword(keyword);
    };

    const onClick = e => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        if (ref.current) {
            ref.current.focus();
        }
    };
    const onChange = e => {
        setValue(e.target.value);
    };
    const onKeyDown = e => {
        // when the field is empty and the user hits backspace remove the right-most target
        if (e.key === Key.BACKSPACE && !value && keywords.length > 0 && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            e.preventDefault();
            _removeKeyword(keywords[keywords.length - 1]);
        } else if (e.key === Key.ENTER) {
            e.preventDefault();
            _addKeyword(e.target.value);
            setValue("");
        }
    };
    const onBlur = e => {
        if (value) {
            addKeyword(e.target.value);
            setValue("");
        }
    };

    return <div className="mx_NotificationsTab_mentionsKeywords_editor" onClick={onClick}>
        {keywords.map(k => <KeywordPill key={k} disabled={disabled} keyword={k} onRemove={_removeKeyword} />)}
        <textarea
            disabled={disabled}
            rows={1}
            onKeyDown={onKeyDown}
            onChange={onChange}
            value={value}
            ref={ref}
            onBlur={onBlur}
        />
    </div>;
};

const onError = (error) => {
    console.error("Failed to update notification settings: " + error);
    Modal.createTrackedDialog("Failed to update keywords", "", ErrorDialog, {
        title: _t("Can't update user notification settings"),
        description: (error && error.message) ? error.message : _t("Operation failed"),
    });
};

const MentionsKeywordsSection: React.FC<IProps> = ({disabled, contentRules, keywordsEnabled, setKeywordsEnabled, soundEnabled}) => {
    const cli = useContext<MatrixClient>(MatrixClientContext);
    let rules = contentRules.rules;
    if (keywordsEnabled) {
        // filter out any disabled rules
        rules = rules.filter(r => r.enabled);
    }

    const keywords = Array.from(new Set(rules.map(r => r.pattern)));
    if (keywords.length) {
        // As keeping the order of per-word push rules hs side is a bit tricky to code,
        // display the keywords in alphabetical order to the user
        keywords.sort();
    }

    const addKeyword = (keyword: string) => {
        ContentRules.addKeywordRule(cli, contentRules, keyword, keywordsEnabled, soundEnabled).catch(onError);
    };

    const removeKeyword = (keyword: string) => {
        ContentRules.removeKeywordRule(cli, contentRules, keyword).catch(onError);
    };

    const onKeywordsEnabledChange = e => {
        setKeywordsEnabled(e.target.checked);

        if (keywords.length < 1) return;
        ContentRules.updateContentRules(cli, contentRules, e.target.checked, soundEnabled).catch(onError);
    };

    return <SettingsSection title={_t("Mentions & Keywords")} className="mx_NotificationsTab_mentionsKeywords">
        <StyledCheckbox disabled={disabled}>
            {_t("Notify when someone mentions using your name")}
        </StyledCheckbox>
        <StyledCheckbox disabled={disabled}>
            {_t("Notify when someone mentions using your username")}
        </StyledCheckbox>
        <StyledCheckbox disabled={disabled} checked={keywordsEnabled} onChange={onKeywordsEnabledChange}>
            {_t("Notify when someone uses a keyword")}
        </StyledCheckbox>
        <div className={classNames("mx_Checkbox_microCopy", {mx_Checkbox_microCopy_disabled: disabled})}>
            {_t("Enter keywords here, or use for spelling variations or nicknames")}
        </div>

        <KeywordsEditor
            initialKeywords={keywords}
            addKeyword={addKeyword}
            removeKeyword={removeKeyword}
            disabled={disabled}
        />
    </SettingsSection>;
};

export default MentionsKeywordsSection;
